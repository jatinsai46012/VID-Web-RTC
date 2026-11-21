import { FileText, ArrowRight } from "lucide-react";
import { useRecorder } from "@/context/RecorderContext";
import { CardTitle } from "./Pill";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DOT = { ok: "bg-emerald-500", process: "bg-blue-500", warn: "bg-amber-500", alert: "bg-red-500" };
const fmt = (d) => d.toLocaleTimeString("en-GB", { hour12: false });

const LogList = ({ logs, testid, className = "" }) => (
  <ul className={`vox-scroll overflow-y-auto pr-2 ${className}`} data-testid={testid}>
    {logs.map((l) => (
      <li key={l.id} className="flex items-center gap-4 py-2 text-sm vox-fadeup">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT[l.type] || DOT.ok}`} />
        <span className="font-mono text-[13px] text-[#0b5f59] w-[64px] shrink-0">{fmt(l.time)}</span>
        <span className="h-4 w-px bg-[#d8ece9]" />
        <span className="text-slate-700 truncate">{l.msg}</span>
      </li>
    ))}
  </ul>
);

export const ActivityLog = () => {
  const { logs } = useRecorder();
  return (
    <section className="vox-card p-5 md:p-6" data-testid="activity-log-card">
      <CardTitle icon={FileText} title="Activity Log" right={
        <Dialog>
          <DialogTrigger className="flex items-center gap-1 text-[#11847c] font-semibold text-sm hover:gap-2 transition-[gap]" data-testid="activity-log-view-all">View All <ArrowRight size={15} /></DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader><DialogTitle className="font-display text-2xl">Full Activity Log</DialogTitle></DialogHeader>
            <LogList logs={logs} testid="activity-log-full-list" className="max-h-[60vh]" />
          </DialogContent>
        </Dialog>
      } />
      <LogList logs={logs.slice(0, 12)} testid="activity-log-list" className="mt-3 max-h-[188px]" />
    </section>
  );
};
