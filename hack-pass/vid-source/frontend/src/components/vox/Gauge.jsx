import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Gauge = ({ value, color, icon: Icon, size = 140 }) => {
  const r = 56, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-testid="detection-gauge-circle">
      <span className="absolute -inset-3 rounded-full" style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }} />
      <svg viewBox="0 0 140 140" className="relative -rotate-90 w-full h-full">
        <circle cx="70" cy="70" r={r} stroke="#e0f5f2" strokeWidth="12" fill="none" />
        <motion.circle cx="70" cy="70" r={r} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }} />
      </svg>
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }}
        className="absolute inset-[24px] rounded-full bg-[#ecfbf8] flex items-center justify-center shadow-inner">
        <Icon size={40} style={{ color }} fill={`${color}22`} />
      </motion.div>
    </div>
  );
};

export const MetricRow = ({ icon: Icon, label, hint, value, display, color = "#11847c", testid, delay = 0 }) => (
  <div className="flex items-center gap-3 py-2.5" data-testid={testid}>
    <span className="h-11 w-11 shrink-0 rounded-full bg-[#e6fbf8] text-[#11847c] flex items-center justify-center"><Icon size={20} /></span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        {label}
        <Tooltip>
          <TooltipTrigger asChild><button aria-label={`About ${label}`} data-testid={`${testid}-info`}><Info size={13} className="text-slate-400" /></button></TooltipTrigger>
          <TooltipContent className="max-w-[220px]">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#e6f4f2] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(3, value)}%` }} transition={{ duration: 1.1, delay }} />
      </div>
    </div>
    <span className="w-14 text-right font-display font-bold text-lg" style={{ color }} data-testid={`${testid}-value`}>{display}</span>
  </div>
);
