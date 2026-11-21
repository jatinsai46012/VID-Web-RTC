import { Mic, MonitorSpeaker, Square, Loader2 } from "lucide-react";
import { useRecorder } from "@/context/RecorderContext";
import { MAX_SECONDS, fmtTime } from "@/lib/audio";
import { riskColor } from "@/lib/verdict";
import { LiveSpectrum } from "./LiveSpectrum";

const MiniBars = () => <LiveSpectrum n={11} className="h-7 w-[60px]" barClass="w-[3px]" testid="island-spectrum" />;

export const IslandContent = ({ prefix = "" }) => {
  const { status, source, elapsed, live, stop } = useRecorder();
  const connecting = status === "requesting";
  const SrcIcon = source === "speaker" ? MonitorSpeaker : Mic;
  const pct = Math.min(100, (elapsed / MAX_SECONDS) * 100);
  return (
    <div className="relative flex items-center gap-3 pl-2 pr-2 py-2 text-white overflow-hidden rounded-full">
      <span className="absolute bottom-0 left-0 h-[2px] bg-[#5fe3d8]/80 transition-[width] duration-100" style={{ width: `${pct}%` }} />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#11847c]">
        {!connecting && <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />}
        <SrcIcon size={18} className="relative" />
      </span>
      <div className="flex flex-col leading-tight min-w-[86px]">
        <span className="text-[10px] tracking-[.22em] font-mono text-[#5fe3d8] flex items-center gap-1.5">
          {connecting ? <><Loader2 size={10} className="animate-spin" />CONNECTING</> : <><span className="h-1.5 w-1.5 rounded-full bg-red-500 vox-blink" />REC</>}
        </span>
        <span className="text-xs text-white/70">{source === "speaker" ? "Speaker output" : "Microphone"}</span>
      </div>
      <MiniBars />
      <div className="font-mono text-sm tabular-nums whitespace-nowrap" data-testid={`${prefix}island-timer`}>
        {fmtTime(elapsed)}<span className="text-white/40"> / {fmtTime(MAX_SECONDS)}</span>
      </div>
      <div className="hidden sm:flex flex-col items-end leading-tight w-[64px]">
        <span className="font-mono text-xs text-[#5fe3d8]" data-testid={`${prefix}island-pitch`}>{live.hz ? `${Math.round(live.hz)} Hz` : "-- Hz"}</span>
        <span className="font-mono text-[10px]" style={{ color: live.risk == null ? "#ffffff66" : riskColor(live.risk) }}>{live.risk == null ? "risk --" : `risk ${live.risk}%`}</span>
      </div>
      <button onClick={stop} disabled={connecting} data-testid={`${prefix}btn-stop-recording`} aria-label="Stop recording"
        className="h-10 w-10 shrink-0 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-[background-color,transform] active:scale-90 disabled:opacity-50">
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  );
};
