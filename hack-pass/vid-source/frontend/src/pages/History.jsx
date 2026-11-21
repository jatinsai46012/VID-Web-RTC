import { useCallback, useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, Mic, MonitorSpeaker, Search, Trash2, Eye, Inbox, Quote } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { VERDICTS, riskColor } from "@/lib/verdict";
import { fmtTime } from "@/lib/audio";
import { CardTitle } from "@/components/vox/Pill";
import { ResultBody } from "@/components/vox/ResultCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FILTERS = [["all", "All"], ["authentic", "Authentic"], ["suspicious", "Suspicious"], ["deepfake", "AI-Generated"]];

const VerdictPill = ({ v }) => {
  const c = VERDICTS[v];
  return <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap" style={{ color: c.color, background: c.soft }} data-testid="history-verdict-pill"><c.icon size={13} />{c.short}</span>;
};

const Spark = ({ data, color }) => (
  <div className="h-10 w-28">
    {data?.length > 1 && (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.filter((d) => d.risk != null)}><Area type="monotone" dataKey="risk" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} dot={false} /><YAxis hide domain={[0, 100]} /></AreaChart>
      </ResponsiveContainer>
    )}
  </div>
);

const Row = ({ a, onOpen, onDelete }) => {
  const SrcIcon = a.source === "speaker" ? MonitorSpeaker : Mic;
  const color = riskColor(a.deepfake_probability);
  return (
    <div className="group flex flex-wrap md:flex-nowrap items-center gap-4 rounded-2xl border border-[#d8f2ee] bg-white px-4 py-3.5 hover:border-[#5fe3d8] hover:shadow-[0_10px_30px_-15px_rgba(17,132,124,.5)] transition-[border-color,box-shadow]" data-testid={`history-row-${a.id}`}>
      <span className="h-12 w-12 rounded-xl bg-[#e6fbf8] flex items-center justify-center shrink-0"><SrcIcon size={22} className="text-[#11847c]" /></span>
      <div className="flex-1 min-w-[150px]">
        <div className="font-semibold text-[#0b3f3b]">{a.title}</div>
        <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()} • {fmtTime(a.duration)}</div>
      </div>
      <VerdictPill v={a.verdict} />
      <Spark data={a.risk_series} color={color} />
      <div className="w-16 text-right"><div className="font-display text-xl font-bold" style={{ color }}>{a.deepfake_probability}%</div><div className="text-[10px] text-slate-400 uppercase">fake risk</div></div>
      <div className="flex gap-1">
        <button onClick={() => onOpen(a.id)} className="h-9 w-9 rounded-lg hover:bg-[#e6fbf8] text-[#11847c] flex items-center justify-center" data-testid={`history-view-${a.id}`} aria-label="View"><Eye size={17} /></button>
        <button onClick={() => onDelete(a.id)} className="h-9 w-9 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" data-testid={`history-delete-${a.id}`} aria-label="Delete"><Trash2 size={17} /></button>
      </div>
    </div>
  );
};

const Detail = ({ id, onClose }) => {
  const [doc, setDoc] = useState(null);
  useEffect(() => { if (id) api.get(`/analyses/${id}`).then((r) => setDoc(r.data)).catch((e) => toast.error(formatApiError(e))); else setDoc(null); }, [id]);
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="history-detail-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">{doc?.title || "Loading..."}</DialogTitle></DialogHeader>
        {!doc ? <div className="space-y-3"><div className="h-36 rounded-xl vox-shimmer" /><div className="h-24 rounded-xl vox-shimmer" /></div> : (
          <div>
            <ResultBody result={doc} />
            {doc.transcript_snippet && <p className="mt-4 flex gap-2 text-sm italic text-slate-600"><Quote size={16} className="text-[#11847c] shrink-0" />{doc.transcript_snippet}</p>}
            {doc.indicators?.length > 0 && (
              <div className="mt-5 space-y-2" data-testid="history-indicators">
                <h4 className="font-semibold text-[#0b3f3b]">What the AI noticed</h4>
                {doc.indicators.map((ind, i) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-[#f6fffd] border border-[#d8f2ee] p-3 text-sm">
                    <span className="h-2.5 w-2.5 mt-1.5 rounded-full shrink-0" style={{ background: { normal: "#10b981", warning: "#f59e0b", alert: "#ef4444" }[ind.status] || "#10b981" }} />
                    <div><b className="text-slate-700">{ind.label}</b><div className="text-slate-500">{ind.detail}</div></div>
                  </div>
                ))}
              </div>
            )}
            {doc.pitch_series?.length > 2 && (
              <div className="mt-5"><h4 className="font-semibold text-[#0b3f3b] mb-2">Pitch timeline</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={doc.pitch_series} margin={{ left: -20, right: 6 }}><CartesianGrid strokeDasharray="3 6" stroke="#e2f3f0" vertical={false} /><XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v)}s`} minTickGap={30} /><YAxis domain={[50, 400]} tick={{ fontSize: 10 }} /><Area dataKey="hz" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} connectNulls={false} /></AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function History() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    setItems(null);
    api.get("/analyses", { params: filter === "all" ? {} : { verdict: filter } }).then((r) => setItems(r.data)).catch((e) => { toast.error(formatApiError(e)); setItems([]); });
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  const del = async (id) => {
    try { await api.delete(`/analyses/${id}`); setItems((l) => l.filter((x) => x.id !== id)); toast.success("Recording deleted"); } catch (e) { toast.error(formatApiError(e)); }
  };
  const shown = useMemo(() => (items || []).filter((a) => a.title.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const counts = useMemo(() => (items || []).reduce((acc, a) => ({ ...acc, [a.verdict]: (acc[a.verdict] || 0) + 1 }), {}), [items]);

  return (
    <section className="vox-card p-5 md:p-7" data-testid="history-page">
      <CardTitle icon={HistoryIcon} title="Recording History" sub="Every voice you've checked, with its verdict" />
      <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} data-testid={`history-filter-${k}`} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${filter === k ? "bg-[#11847c] text-white" : "bg-[#e6fbf8] text-[#0b5f59] hover:bg-[#d3f5f0]"}`}>
              {label}{filter === "all" && k !== "all" && counts[k] ? ` (${counts[k]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings" data-testid="history-search-input" className="w-full rounded-full border border-[#cdeee9] bg-[#f6fffd] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#11847c]" />
        </div>
      </div>
      <div className="mt-6 space-y-3" data-testid="history-recordings-table">
        {items === null && [0, 1, 2, 3].map((i) => <div key={i} className="h-[74px] rounded-2xl vox-shimmer" data-testid="history-skeleton" />)}
        {items && shown.length === 0 && (
          <div className="py-16 text-center text-slate-500" data-testid="history-empty">
            <Inbox size={44} className="mx-auto text-[#a7dcd5]" />
            <p className="mt-3 font-semibold text-[#0b3f3b]">No recordings yet</p>
            <p className="text-sm">Go to Home and press "Use Microphone" to check your first voice.</p>
          </div>
        )}
        {shown.map((a) => <Row key={a.id} a={a} onOpen={setOpen} onDelete={del} />)}
      </div>
      <Detail id={open} onClose={() => setOpen(null)} />
    </section>
  );
}
