import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, UserRound, ShieldCheck, BarChart3, ShieldQuestion } from "lucide-react";
import { useRecorder } from "@/context/RecorderContext";
import { VERDICTS, riskColor } from "@/lib/verdict";
import { Gauge, MetricRow } from "./Gauge";
import { CardTitle, Pill } from "./Pill";

const HINTS = {
  deep: "Chance the voice was created by an AI voice app (text-to-speech or voice cloning).",
  imp: "Chance someone is pretending to be another person using a copied voice.",
  conf: "How sure the AI is about this result. Higher is more reliable.",
  sig: "How clear the audio was. Poor audio makes results less reliable.",
};
const STEPS = ["Checking pitch naturalness", "Scanning for robotic artifacts", "Listening for breathing & pauses", "Comparing against AI voice patterns", "Locking final verdict"];

const SkeletonRow = ({ i }) => (
  <div className="flex items-center gap-3 py-2.5">
    <span className="h-11 w-11 rounded-full vox-shimmer" />
    <div className="flex-1 space-y-2"><div className="h-3 w-1/2 rounded vox-shimmer" style={{ animationDelay: `${i * 0.1}s` }} /><div className="h-2 rounded-full vox-shimmer" /></div>
    <span className="h-5 w-10 rounded vox-shimmer" />
  </div>
);

const ResultSkeleton = () => {
  const { status, live } = useRecorder();
  const [step, setStep] = useState(0);
  useEffect(() => { const i = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1300); return () => clearInterval(i); }, []);
  const analyzing = status === "analyzing";
  return (
    <div data-testid="result-skeleton">
      <div className="flex items-center gap-5 mt-5">
        <div className="relative h-[140px] w-[140px] shrink-0">
          <span className="absolute inset-0 rounded-full border-[12px] border-[#e0f5f2]" />
          <span className="absolute inset-0 rounded-full vox-spin" style={{ background: "conic-gradient(from 0deg, transparent 0 70%, rgba(20,184,166,.75) 100%)", WebkitMask: "radial-gradient(circle, transparent 57%, #000 58%)", mask: "radial-gradient(circle, transparent 57%, #000 58%)" }} />
          <span className="absolute inset-[24px] rounded-full bg-[#ecfbf8] flex items-center justify-center overflow-hidden">
            <span className="absolute inset-0 vox-spin-slow" style={{ background: "conic-gradient(from 0deg, rgba(95,227,216,.0), rgba(95,227,216,.45) 15%, transparent 25%)" }} />
            <ShieldQuestion size={38} className="relative text-[#11847c] animate-pulse" />
          </span>
        </div>
        <div className="flex-1 space-y-3">
          <div className="text-xs font-mono uppercase tracking-[.2em] text-[#11847c]">{analyzing ? "Forensic AI" : "Live scan"}</div>
          <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-display text-lg font-bold text-[#0b3f3b]" data-testid="result-skeleton-step">
            {analyzing ? STEPS[step] : "Collecting voice fingerprints..."}
          </motion.div>
          <div className="h-3 w-4/5 rounded vox-shimmer" /><div className="h-3 w-3/5 rounded vox-shimmer" />
          {!analyzing && live.risk != null && <div className="text-sm text-slate-500">Live estimate: <b style={{ color: riskColor(live.risk) }}>{live.risk}% fake risk</b></div>}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-[#d8f2ee] px-4 py-1">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} i={i} />)}</div>
    </div>
  );
};

const Idle = () => (
  <div data-testid="result-idle">
    <div className="flex items-center gap-5 mt-5">
      <div className="h-[140px] w-[140px] shrink-0 rounded-full border-[12px] border-dashed border-[#d3efea] flex items-center justify-center"><ShieldCheck size={42} className="text-[#a7dcd5]" /></div>
      <div>
        <h3 className="font-display text-2xl font-bold text-[#0b3f3b]">Waiting for audio</h3>
        <p className="text-slate-500 mt-1 text-[15px]">Start a scan and we'll tell you if the voice is real or made by AI.</p>
      </div>
    </div>
    <div className="mt-5 rounded-2xl border border-[#d8f2ee] px-4 py-1 opacity-60">
      <MetricRow icon={Brain} label="Deepfake Probability" hint={HINTS.deep} value={0} display="--" testid="metric-bar-deepfake-prob" />
      <MetricRow icon={UserRound} label="Impersonation Probability" hint={HINTS.imp} value={0} display="--" testid="metric-bar-impersonation-prob" />
      <MetricRow icon={ShieldCheck} label="Audio Confidence" hint={HINTS.conf} value={0} display="--" testid="metric-bar-confidence" />
      <MetricRow icon={BarChart3} label="Signal Quality" hint={HINTS.sig} value={0} display="--" testid="metric-bar-signal" />
    </div>
  </div>
);

export const ResultBody = ({ result }) => {
  const v = VERDICTS[result.verdict];
  const real = 100 - result.deepfake_probability;
  const sig = { Good: 92, Fair: 60, Poor: 28 }[result.signal_quality] ?? 60;
  return (
    <div data-testid="result-final">
      <div className="flex items-center gap-5 mt-5">
        <Gauge value={result.verdict === "authentic" ? real : result.deepfake_probability} color={v.color} icon={v.icon} />
        <div className="min-w-0">
          <motion.h3 initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="font-display text-2xl md:text-[30px] font-extrabold leading-tight" style={{ color: v.color }} data-testid="verdict-status-badge">{v.label}</motion.h3>
          <p className="text-slate-600 mt-1 text-[15px]" data-testid="verdict-summary">{result.summary || v.text}</p>
          {!result.ai_used && <p className="text-xs text-amber-600 mt-1">AI engine offline - acoustic check only</p>}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-[#d8f2ee] px-4 py-1">
        <MetricRow icon={Brain} label="Deepfake Probability" hint={HINTS.deep} value={result.deepfake_probability} display={`${result.deepfake_probability}%`} color={riskColor(result.deepfake_probability)} testid="metric-bar-deepfake-prob" />
        <MetricRow icon={UserRound} label="Impersonation Probability" hint={HINTS.imp} value={result.impersonation_probability} display={`${result.impersonation_probability}%`} color={riskColor(result.impersonation_probability)} testid="metric-bar-impersonation-prob" delay={0.1} />
        <MetricRow icon={ShieldCheck} label="Audio Confidence" hint={HINTS.conf} value={result.confidence} display={`${result.confidence}%`} testid="metric-bar-confidence" delay={0.2} />
        <MetricRow icon={BarChart3} label="Signal Quality" hint={HINTS.sig} value={sig} display={result.signal_quality} testid="metric-bar-signal" delay={0.3} />
      </div>
    </div>
  );
};

export const ResultCard = () => {
  const { status, result } = useRecorder();
  const busy = ["recording", "analyzing", "requesting"].includes(status);
  const pill = busy ? <Pill testid="result-status-pill">Live Analysis</Pill> : result ? <Pill live={false} testid="result-status-pill">AI Verdict</Pill> : <Pill live={false} testid="result-status-pill">Standby</Pill>;
  return (
    <section className="vox-card p-5 md:p-6" data-testid="detection-result-card">
      <CardTitle icon={ShieldCheck} title="Detection Result" right={pill} />
      <div className="h-px bg-[#e3f4f1] mt-4" />
      {busy ? <ResultSkeleton /> : result ? <ResultBody result={result} /> : <Idle />}
    </section>
  );
};
