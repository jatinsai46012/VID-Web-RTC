import { useEffect, useRef } from "react";

const LAYERS = [
  { rgb: "95,227,216", alpha: 0.9, amp: 0.26, freq: 9, speed: 0.9, base: 0.62, width: 2 },
  { rgb: "20,184,166", alpha: 0.6, amp: 0.2, freq: 13, speed: -0.6, base: 0.68, width: 1.6 },
  { rgb: "167,243,208", alpha: 0.35, amp: 0.32, freq: 6, speed: 0.45, base: 0.74, width: 1.2 },
];

export const PeakWaves = ({ intensity = 1 }) => {
  const ref = useRef(null);
  const target = useRef(intensity);
  useEffect(() => { target.current = intensity; }, [intensity]);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let raf, t = 0, k = 1;
    const draw = () => {
      const w = (c.width = c.offsetWidth * dpr), h = (c.height = c.offsetHeight * dpr);
      t += 0.016;
      k += (target.current - k) * 0.05;
      LAYERS.forEach((L) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3 * dpr) {
          const nx = x / w;
          const s = Math.sin(nx * L.freq + t * L.speed) * Math.sin(nx * L.freq * 0.41 - t * L.speed * 0.7);
          const peak = Math.pow(Math.abs(s), 3) * L.amp * h * k;
          const y = L.base * h - peak - Math.sin(nx * 40 + t * 4) * 2 * dpr * k;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${L.rgb},${L.alpha})`;
        ctx.lineWidth = L.width * dpr;
        ctx.shadowColor = `rgba(${L.rgb},.9)`;
        ctx.shadowBlur = 18 * dpr;
        ctx.stroke();
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, h * 0.3, 0, h);
        g.addColorStop(0, `rgba(${L.rgb},${0.12 * L.alpha})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.fill();
      });
      const bars = 90, bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = Math.pow(Math.abs(Math.sin(i * 0.45 + t * 2.4) * Math.cos(i * 0.12 - t * 1.4)), 2);
        const bh = (0.08 + 0.92 * v) * h * 0.1 * k;
        ctx.fillStyle = `rgba(95,227,216,${0.15 + v * 0.35})`;
        ctx.fillRect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" data-testid="login-peak-waves" />;
};
