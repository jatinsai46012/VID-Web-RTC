import { AnimatePresence, motion } from "framer-motion";
import { Mic, MonitorSpeaker, Radio, ScanLine, RotateCcw, Square } from "lucide-react";
import { useRecorder } from "@/context/RecorderContext";
import { IslandContent } from "./DynamicIsland";
import { LiveSpectrum } from "./LiveSpectrum";

const spring = { type: "spring", stiffness: 240, damping: 24 };

const Arcs = ({ side }) => (
  <div className={`absolute top-1/2 -translate-y-1/2 flex gap-2 ${side === "left" ? "right-[calc(50%+105px)] flex-row-reverse" : "left-[calc(50%+105px)]"}`}>
    {[22, 34, 46].map((h, i) => (
      <span key={h} className="vox-arc border-[#5fe3d8] rounded-full" style={{ height: h, width: h / 2.2, borderWidth: 0, [side === "left" ? "borderLeftWidth" : "borderRightWidth"]: 3, borderStyle: "solid", animationDelay: `${i * 0.25}s` }} />
    ))}
  </div>
);

const Orb = ({ analyzing }) => (
  <div className="relative flex items-center justify-center">
    {[0, 0.9, 1.8].map((d) => <span key={d} className="absolute h-[170px] w-[170px] rounded-full bg-[#5fe3d8]/35 vox-ripple" style={{ animationDelay: `${d}s` }} />)}
    <span className="absolute h-[205px] w-[205px] rounded-full bg-[radial-gradient(circle,rgba(95,227,216,.35),transparent_70%)]" />
    {analyzing && <span className="absolute h-[186px] w-[186px] rounded-full border-[3px] border-dashed border-[#11847c]/60 vox-spin" />}
    <motion.div layoutId="vox-island" transition={spring} style={{ borderRadius: 999 }}
      className="relative h-[152px] w-[152px] bg-gradient-to-b from-[#16978d] to-[#0c6a63] ring-[12px] ring-[#cdf7f2] shadow-[0_18px_40px_-10px_rgba(12,106,99,.7)] flex items-center justify-center" data-testid="mic-orb">
      {analyzing ? <ScanLine size={54} className="text-white animate-pulse" /> : <Mic size={58} className="text-white" strokeWidth={1.8} />}
    </motion.div>
  </div>
);

const StatusLabel = ({ status }) => {
  const map = { idle: ["Ready to listen", "bg-slate-400"], requesting: ["Waiting for permission...", "bg-amber-500"], recording: ["Listening...", "bg-emerald-500"], analyzing: ["AI is checking the voice...", "bg-blue-500"], done: ["Scan complete", "bg-emerald-500"] };
  const [text, dot] = map[status] || map.idle;
  return (
    <div className="flex items-center gap-2 text-[#11847c] font-semibold" data-testid="recorder-status-label">
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${status === "recording" ? "vox-blink" : ""}`} />{text}
    </div>
  );
};

const Stage = () => {
  const { status, active } = useRecorder();
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative h-[230px] w-full flex items-center justify-center">
        {!active && <><Arcs side="left" /><Arcs side="right" /></>}
        <AnimatePresence mode="popLayout" initial={false}>
          {active ? (
            <motion.div key="island" layoutId="vox-island" transition={spring} style={{ borderRadius: 999 }}
              className="bg-[#04201e] shadow-[0_24px_60px_-12px_rgba(4,32,30,.75)] ring-1 ring-white/10" data-testid="dynamic-island-container">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}><IslandContent /></motion.div>
            </motion.div>
          ) : (
            <motion.div key="orb" exit={{ opacity: 0 }}><Orb analyzing={status === "analyzing"} /></motion.div>
          )}
        </AnimatePresence>
      </div>
      <StatusLabel status={status} />
      <div className="w-full max-w-[440px] mt-2"><LiveSpectrum n={45} className="h-12" /></div>
    </div>
  );
};

const Actions = ({ compact }) => {
  const { status, active, start, stop, reset, source } = useRecorder();
  const busy = status === "analyzing";
  const btn = "flex-1 flex items-center justify-center gap-3 rounded-full py-4 px-6 text-white font-semibold text-[15px] md:text-base shadow-[0_12px_24px_-10px_rgba(12,106,99,.8)] transition-[background-color,transform,opacity] active:scale-95 disabled:opacity-50";
  if (status === "recording") {
    return (
      <button onClick={stop} data-testid="btn-stop-analyse" className={`${btn} w-full bg-red-500 hover:bg-red-600`}>
        <Square size={18} fill="currentColor" /> Stop & Check Voice ({source === "speaker" ? "Speaker" : "Mic"})
      </button>
    );
  }
  return (
    <div className={`flex gap-4 ${compact ? "flex-col" : "flex-col sm:flex-row"}`}>
      <button disabled={active || busy} onClick={() => start("speaker")} data-testid="btn-capture-speaker" className={`${btn} bg-[#14928a] hover:bg-[#0f7d76]`}>
        <MonitorSpeaker size={22} /> Capture Speaker Output
      </button>
      <button disabled={active || busy} onClick={() => start("mic")} data-testid="btn-use-microphone" className={`${btn} bg-[#14928a] hover:bg-[#0f7d76]`}>
        <Mic size={22} /> Use Microphone
      </button>
      {status === "done" && (
        <button onClick={reset} data-testid="btn-new-scan" aria-label="New scan" className="sm:w-14 h-14 rounded-full border-2 border-[#14928a] text-[#14928a] flex items-center justify-center hover:bg-[#e6fbf8] transition-colors">
          <RotateCcw size={20} />
        </button>
      )}
    </div>
  );
};

const InfoStrip = () => {
  const { status, source } = useRecorder();
  const text = status === "recording"
    ? `Audio is being captured from your ${source === "speaker" ? "speaker output (call audio)" : "microphone"} and analysed in real time.`
    : status === "analyzing" ? "Sending the voice sample to the forensic AI. This takes a few seconds."
    : null;
  return (
    <div className="mt-6 flex items-center gap-4 rounded-2xl border border-[#cdeee9] bg-[#f6fffd] px-5 py-3.5 text-sm text-slate-600" data-testid="recorder-info-strip">
      <Radio size={22} className="text-[#11847c] shrink-0" />
      {text ? <span>{text}</span> : (
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          {["Pick the voice source", "Let them talk (up to 30s)", "See if it's real or AI-made"].map((t, i) => <span key={t}><b className="text-[#11847c]">{i + 1}.</b> {t}</span>)}
        </span>
      )}
    </div>
  );
};

export const LiveDetectionCard = ({ compact = false }) => (
  <section className="vox-card p-5 md:p-6" data-testid="live-detection-card">
    <div className="flex items-start gap-4">
      <span className="h-14 w-14 shrink-0 rounded-full bg-[#e3faf6] flex items-center justify-center"><Mic size={28} className="text-[#11847c]" /></span>
      <div>
        <h2 className="font-display text-2xl md:text-[27px] font-bold text-[#0b3f3b] leading-tight">Live Audio Detection</h2>
        <p className="text-sm md:text-[15px] text-slate-600 mt-1">Capture a call from your speaker or use your microphone to check a voice in real time.</p>
      </div>
    </div>
    <Stage />
    <div className="mt-5"><Actions compact={compact} /></div>
    <InfoStrip />
  </section>
);
