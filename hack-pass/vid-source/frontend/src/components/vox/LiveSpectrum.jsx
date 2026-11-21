import { useEffect, useRef } from "react";
import { useRecorder } from "@/context/RecorderContext";

// Real FFT bars: centre = low (voice) frequencies, edges = high frequencies, mirrored.
export const LiveSpectrum = ({ n = 41, className = "h-12", barClass = "w-[3px]", testid = "spectrum-bars", minHz = 70, maxHz = 5000 }) => {
  const { analyserRef } = useRecorder();
  const wrap = useRef(null);
  useEffect(() => {
    const bars = [...wrap.current.children];
    const level = new Float32Array(n);
    const mid = (n - 1) / 2;
    let raf, t = 0, data = null;
    const loop = () => {
      const an = analyserRef.current;
      t += 0.03;
      if (an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const binHz = an.context.sampleRate / an.fftSize;
        for (let i = 0; i < n; i++) {
          const d0 = Math.abs(i - mid) / (mid + 1), d1 = d0 + 1 / (mid + 1);
          const b0 = Math.floor((minHz * Math.pow(maxHz / minHz, d0)) / binHz);
          const b1 = Math.max(b0 + 1, Math.ceil((minHz * Math.pow(maxHz / minHz, d1)) / binHz));
          let m = 0;
          for (let b = b0; b < b1 && b < data.length; b++) if (data[b] > m) m = data[b];
          const v = m / 255;
          level[i] = v > level[i] ? v : level[i] * 0.82 + v * 0.18;
        }
      } else {
        for (let i = 0; i < n; i++) {
          const d = Math.abs(i - mid) / mid;
          level[i] = 0.1 + 0.16 * (Math.sin(i * 0.8 + t * 2.2) * 0.5 + 0.5) * (1 - d * 0.6);
        }
      }
      for (let i = 0; i < n; i++) bars[i].style.transform = `scaleY(${Math.max(0.06, level[i]).toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, n, minHz, maxHz]);
  return (
    <div ref={wrap} className={`flex items-center justify-center gap-[3px] ${className}`} data-testid={testid}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={`${barClass} h-full rounded-full will-change-transform ${Math.abs(i - (n - 1) / 2) <= 1 ? "bg-[#ff8c50]" : "bg-[#2fd3b4]"}`} />
      ))}
    </div>
  );
};

// Linear FFT scope 0-1000 Hz with a live marker on the detected pitch.
export const FrequencyScope = () => {
  const { analyserRef, pitchRef } = useRecorder();
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let raf, data = null, t = 0;
    const MAX = 1000;
    const draw = () => {
      const w = (c.width = c.offsetWidth * dpr), h = (c.height = c.offsetHeight * dpr);
      const an = analyserRef.current;
      t += 0.03;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, "rgba(17,132,124,.15)"); g.addColorStop(1, "rgba(47,211,180,.9)");
      ctx.beginPath(); ctx.moveTo(0, h);
      if (an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const binHz = an.context.sampleRate / an.fftSize, bins = Math.floor(MAX / binHz);
        for (let b = 0; b <= bins; b++) ctx.lineTo((b / bins) * w, h - (data[b] / 255) * h * 0.95);
      } else {
        for (let x = 0; x <= w; x += 4 * dpr) ctx.lineTo(x, h - (0.06 + 0.05 * Math.sin(x / (30 * dpr) + t * 3)) * h);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "#11847c"; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      const hz = pitchRef.current;
      if (an && hz) {
        const x = (hz / MAX) * w;
        ctx.fillStyle = "#ff8c50"; ctx.fillRect(x - dpr, 0, 2 * dpr, h);
        ctx.font = `${10 * dpr}px JetBrains Mono`; ctx.fillText(`${Math.round(hz)} Hz`, Math.min(x + 4 * dpr, w - 50 * dpr), 12 * dpr);
      }
      ctx.fillStyle = "#94a3b8"; ctx.font = `${9 * dpr}px JetBrains Mono`;
      [0, 250, 500, 750].forEach((f) => ctx.fillText(`${f}`, (f / MAX) * w + 2 * dpr, h - 3 * dpr));
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, pitchRef]);
  return <canvas ref={ref} className="w-full h-[70px] rounded-xl bg-[#f6fffd] border border-[#d8f2ee]" data-testid="frequency-scope" />;
};
