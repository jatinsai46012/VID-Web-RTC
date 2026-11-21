import { LineChart as LineIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRecorder } from "@/context/RecorderContext";
import { riskColor } from "@/lib/verdict";
import { CardTitle } from "./Pill";
import { ChartSkeleton } from "./ChartSkeleton";

export const LiveRiskCard = ({ height = 210 }) => {
  const { riskSeries, status, live, result } = useRecorder();
  const data = riskSeries.filter((r) => r.risk != null);
  const current = status === "done" && result ? result.deepfake_probability : live.risk;
  const color = current == null ? "#94a3b8" : riskColor(current);
  return (
    <section className="vox-card p-5 md:p-6 h-full" data-testid="live-risk-card">
      <CardTitle icon={LineIcon} title="Live Detection Chart" sub="How fake the voice looks, second by second"
        right={<div className="text-right"><div className="font-display text-3xl font-extrabold tabular-nums" style={{ color }} data-testid="live-risk-value">{current == null ? "--" : `${current}%`}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">{status === "done" ? "AI verdict" : "live estimate"}</div></div>} />
      <div className="mt-4" data-testid="live-risk-chart">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.5} /><stop offset="1" stopColor={color} stopOpacity={0.02} /></linearGradient>
              </defs>
              <ReferenceArea y1={65} y2={100} fill="#ef4444" fillOpacity={0.06} />
              <ReferenceArea y1={35} y2={65} fill="#f59e0b" fillOpacity={0.06} />
              <CartesianGrid strokeDasharray="3 6" stroke="#e2f3f0" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}s`} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip formatter={(v) => [`${v}%`, "Fake risk"]} labelFormatter={(l) => `${l}s`} />
              <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "danger line", fontSize: 10, fill: "#ef4444", position: "insideTopRight" }} />
              {status === "done" && result && <ReferenceLine y={result.deepfake_probability} stroke="#0b3f3b" strokeWidth={2} label={{ value: "AI verdict", fontSize: 10, fill: "#0b3f3b", position: "insideBottomLeft" }} />}
              <Area type="monotone" dataKey="risk" stroke={color} strokeWidth={2.5} fill="url(#riskFill)" isAnimationActive={false} dot={{ r: 2.5, fill: color }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartSkeleton height={height} testid="risk-chart-skeleton" label={status === "recording" ? "Building live verdict..." : "The live verdict will appear here"} />
        )}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />0-34 Real</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />35-64 Suspicious</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />65-100 AI-made</span>
      </div>
    </section>
  );
};
