import { useMemo } from "react";
import { Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRecorder } from "@/context/RecorderContext";
import { CardTitle, Pill } from "./Pill";
import { ChartSkeleton } from "./ChartSkeleton";
import { FrequencyScope } from "./LiveSpectrum";

const naturalness = (sd) => sd > 20 ? ["Natural wobble", "#10b981"] : sd > 10 ? ["Slightly flat", "#f59e0b"] : ["Very flat (robot-like)", "#ef4444"];

const Stat = ({ label, value, color = "#0b3f3b", testid }) => (
  <div className="rounded-xl bg-[#f3fdfb] border border-[#d8f2ee] px-3 py-2.5" data-testid={testid}>
    <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-display text-lg font-bold" style={{ color }}>{value}</div>
  </div>
);

export const PitchCard = ({ height = 210 }) => {
  const { pitchSeries, status, live } = useRecorder();
  const data = pitchSeries.slice(-150);
  const stats = useMemo(() => {
    const v = pitchSeries.map((p) => p.hz).filter(Boolean);
    if (v.length < 3) return null;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return { mean: Math.round(m), sd: Math.round(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)) };
  }, [pitchSeries]);
  const hasVoice = data.some((p) => p.hz);
  const [nat, natColor] = stats ? naturalness(stats.sd) : ["--", "#94a3b8"];
  return (
    <section className="vox-card p-5 md:p-6 h-full" data-testid="pitch-analyser-card">
      <CardTitle icon={Activity} title="Pitch Analyser" sub="Real voices wobble naturally. AI voices often stay too smooth."
        right={<span className="font-mono text-2xl font-bold text-[#11847c] tabular-nums" data-testid="pitch-current-hz">{live.hz && status === "recording" ? `${Math.round(live.hz)}` : "--"}<span className="text-sm text-slate-400"> Hz</span></span>} />
      <div className="mt-4" data-testid="pitch-analyser-chart">
        {hasVoice ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="pitchFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14b8a6" stopOpacity={0.45} /><stop offset="1" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="#d8f2ee" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v)}s`} minTickGap={30} />
              <YAxis domain={[50, 400]} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip formatter={(v) => [`${v} Hz`, "Pitch"]} labelFormatter={(l) => `${l}s`} />
              <Area type="monotone" dataKey="hz" stroke="#0d9488" strokeWidth={2.5} fill="url(#pitchFill)" isAnimationActive={false} connectNulls={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartSkeleton height={height} testid="pitch-chart-skeleton" label={status === "recording" ? "Listening for a voice..." : "Start a scan to see the live pitch"} />
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 mb-1.5"><span>Live frequency spectrum (0-1000 Hz)</span><span className="text-[#ff8c50] normal-case">orange line = your voice pitch</span></div>
        <FrequencyScope />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Stat label="Avg pitch" value={stats ? `${stats.mean} Hz` : "--"} testid="pitch-stat-avg" />
        <Stat label="Variation" value={stats ? `±${stats.sd} Hz` : "--"} testid="pitch-stat-variation" />
        <Stat label="Feels" value={nat} color={natColor} testid="pitch-stat-naturalness" />
      </div>
      {status === "recording" && <div className="mt-3"><Pill testid="pitch-live-pill">Tracking fundamental frequency (F0)</Pill></div>}
    </section>
  );
};
