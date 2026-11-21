import { useEffect, useRef } from "react";
import { AudioWaveform } from "lucide-react";
import { useRecorder } from "@/context/RecorderContext";
import { MAX_SECONDS, fmtTime } from "@/lib/audio";
import { riskColor } from "@/lib/verdict";
import { Pill } from "./Pill";

const WaveCanvas = () => {
  const ref = useRef(null);
  const { analyserRef } = useRecorder();
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let raf, t = 0, hist = [];
    const buf = new Float32Array(2048);
    const draw = () => {
      const w = (c.width = c.offsetWidth * dpr), h = (c.height = c.offsetHeight * dpr);
      const gap = 5 * dpr, bw = 2.6 * dpr, n = Math.floor(w / gap);
      const an = analyserRef.current;
      t += 0.04;
      let amp;
      if (an) {
        an.getFloatTimeDomainData(buf);
        let pk = 0; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i]));
        amp = Math.min(1, pk * 1.6);
      } else {
        amp = 0.08 + 0.06 * Math.abs(Math.sin(t * 1.3) * Math.sin(t * 0.37));
      }
      hist.push(amp);
      if (hist.length > n) hist = hist.slice(-n);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#5fe3d8"); g.addColorStop(0.5, "#11847c"); g.addColorStop(1, "#5fe3d8");
      ctx.fillStyle = g;
      const off = n - hist.length;
      hist.forEach((a, i) => {
        const x = (off + i) * gap;
        const wob = an ? 1 : 0.6 + 0.4 * Math.sin(i * 0.6 + t * 3);
        const bh = Math.max(2 * dpr, a * wob * h * 0.92);
        ctx.globalAlpha = 0.45 + 0.55 * (i / hist.length);
        ctx.fillRect(x, (h - bh) / 2, bw, bh);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#11847c";
      ctx.fillRect(w / 2 - dpr, 0, 2 * dpr, h);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);
  return <canvas ref={ref} className="w-full h-[130px]" data-testid="waveform-canvas" />;
};

export const Timeline = () => {
  const { elapsed, riskSeries, status } = useRecorder();
  const pct = Math.min(100, (elapsed / MAX_SECONDS) * 100);
  return (
    <div className="mt-4" data-testid="recording-timeline">
      <div className="relative h-3 rounded-full bg-[#e6f4f2] overflow-hidden">
        {riskSeries.map((r) => (
          <span key={r.t} className="absolute top-0 h-full" style={{ left: `${((r.t - 1) / MAX_SECONDS) * 100}%`, width: `${100 / MAX_SECONDS}%`, background: r.risk == null ? "#b6e7e1" : riskColor(r.risk), opacity: 0.85 }} />
        ))}
        {status === "recording" && <span className="absolute top-0 h-full w-1 rounded-full bg-[#04201e] transition-[left] duration-100" style={{ left: `calc(${pct}% - 2px)` }} />}
      </div>
      <div className="flex justify-between mt-1.5 font-mono text-[10px] text-slate-400">
        {[0, 5, 10, 15, 20, 25, 30].map((s) => <span key={s}>{s}s</span>)}
      </div>
    </div>
  );
};

export const WaveformCard = () => {
  const { status, elapsed } = useRecorder();
  const label = { recording: "Analyzing audio stream...", analyzing: "Running forensic AI...", done: "Recording analysed", requesting: "Connecting...", idle: "Waiting for audio input" }[status];
  return (
    <section className="vox-card p-5 md:p-6" data-testid="waveform-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-full bg-[#e3faf6] flex items-center justify-center"><AudioWaveform size={24} className="text-[#11847c]" /></span>
          <h2 className="font-display text-xl md:text-[23px] font-bold text-[#0b3f3b]">Live Audio Waveform</h2>
        </div>
        <Pill live={status === "recording"} testid="waveform-realtime-pill">Real-time</Pill>
      </div>
      <div className="mt-4 rounded-2xl border border-[#d5efeb] px-4 pt-4 pb-3" data-testid="waveform-canvas-container">
        <WaveCanvas />
        <Timeline />
        <div className="flex items-center justify-between mt-2 text-xs md:text-sm text-slate-500">
          <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${status === "recording" ? "bg-emerald-500 vox-blink" : "bg-slate-300"}`} />{label}</span>
          <span className="font-mono tabular-nums" data-testid="waveform-timer">{fmtTime(elapsed)} / {fmtTime(MAX_SECONDS)}</span>
        </div>
      </div>
    </section>
  );
};
