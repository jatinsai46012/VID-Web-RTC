import { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { MAX_SECONDS, aggregate, blobToWav, detectPitch, fmtTime, spectralFlatness, windowRisk } from "@/lib/audio";
import { VERDICTS } from "@/lib/verdict";

const RecorderCtx = createContext(null);
const mkLog = (msg, type = "ok") => ({ id: `${Date.now()}-${Math.random()}`, time: new Date(), msg, type });

export function RecorderProvider({ children }) {
  const [status, setStatus] = useState("idle");
  const [source, setSource] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [pitchSeries, setPitchSeries] = useState([]);
  const [riskSeries, setRiskSeries] = useState([]);
  const [live, setLive] = useState({ hz: 0, level: 0, risk: null });
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState(() => [mkLog("Forensic AI engine ready"), mkLog("System initialised")]);
  const analyserRef = useRef(null);
  const pitchRef = useRef(0);
  const s = useRef({});

  const log = useCallback((msg, type) => setLogs((l) => [mkLog(msg, type), ...l].slice(0, 100)), []);

  const cleanup = () => {
    clearInterval(s.current.timer);
    s.current.stream?.getTracks().forEach((t) => t.stop());
    s.current.ctx?.close().catch(() => {});
    analyserRef.current = null;
    pitchRef.current = 0;
  };

  const stop = useCallback(async () => {
    const st = s.current;
    if (!st.rec || st.stopping) return;
    st.stopping = true;
    clearInterval(st.timer);
    const dur = (performance.now() - st.t0) / 1000;
    if (st.rec.state !== "inactive") await new Promise((res) => { st.rec.onstop = res; st.rec.stop(); });
    cleanup();
    log(`Recording stopped at ${fmtTime(dur)}`, "process");
    if (dur < 2) {
      toast.error("Too short - please record at least 2 seconds of voice.");
      setStatus("idle");
      s.current = {};
      return;
    }
    setStatus("analyzing");
    log("Analysing voice patterns with forensic AI...", "process");
    try {
      const { wav, duration } = await blobToWav(new Blob(st.chunks, { type: st.rec.mimeType }));
      const risks = st.risks.filter((r) => r != null);
      const meta = {
        ...aggregate(st.pitches, st.flats, st.voiced / Math.max(1, st.frames)),
        duration, source: st.source,
        live_risk_avg: risks.length ? Math.round(risks.reduce((a, b) => a + b, 0) / risks.length) : null,
        pitch_series: st.series.filter((_, i) => i % 2 === 0),
        risk_series: st.riskPts,
      };
      const fd = new FormData();
      fd.append("audio", wav, "capture.wav");
      fd.append("meta", JSON.stringify(meta));
      const { data } = await api.post("/analyses", fd);
      setResult(data);
      setStatus("done");
      log(data.verdict === "authentic" ? "No deepfake detected" : `${VERDICTS[data.verdict].label} detected`, data.verdict === "authentic" ? "ok" : data.verdict === "suspicious" ? "warn" : "alert");
      log("Analysis completed", "ok");
    } catch (e) {
      toast.error(formatApiError(e));
      log("Analysis failed", "alert");
      setStatus("idle");
    }
    s.current = {};
  }, [log]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const tick = () => {
    const st = s.current, an = analyserRef.current;
    if (!an) return;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    const { hz: raw, rms } = detectPitch(buf, st.ctx.sampleRate);
    st.raw = [...st.raw.slice(-2), raw];
    const voicedRaw = st.raw.filter(Boolean);
    const hz = raw && voicedRaw.length >= 2 ? [...voicedRaw].sort((a, b) => a - b)[voicedRaw.length >> 1] : raw;
    pitchRef.current = hz;
    st.ticks++;
    if (st.ticks % 2) return;
    const fbuf = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(fbuf);
    const flat = spectralFlatness(fbuf);
    const t = (performance.now() - st.t0) / 1000;
    st.frames++;
    if (hz) {
      st.voiced++; st.pitches.push(hz); st.win.push(hz);
      if (!st.heard) { st.heard = true; log("Voice detected - collecting fingerprints", "process"); }
    }
    st.flats.push(flat);
    const point = { t: +t.toFixed(1), hz: hz ? Math.round(hz) : null };
    st.series.push(point);
    setPitchSeries((p) => [...p, point]);
    if (t - st.lastRiskT >= 1) {
      st.lastRiskT = t;
      const raw = windowRisk(st.win, flat);
      st.win = [];
      if (raw != null) st.smooth = st.smooth == null ? raw : Math.round(0.6 * st.smooth + 0.4 * raw);
      st.risks.push(st.smooth);
      const rp = { t: Math.round(t), risk: st.smooth };
      st.riskPts.push(rp);
      setRiskSeries((r) => [...r, rp]);
      if (st.smooth >= 65 && !st.warned) { st.warned = true; log(`Synthetic-like pattern at ${fmtTime(t)}`, "warn"); }
    }
    setLive({ hz, level: rms, risk: st.smooth });
    setElapsed(t);
    if (t >= MAX_SECONDS) stopRef.current();
  };

  const start = useCallback(async (src) => {
    if (s.current.rec) return;
    setStatus("requesting");
    setSource(src);
    try {
      let stream;
      if (src === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false } });
        if (!stream.getAudioTracks().length) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error('No audio was shared. Choose the call tab/screen and switch ON "Share audio".');
        }
      }
      const audioStream = new MediaStream(stream.getAudioTracks());
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.35;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -15;
      ctx.createMediaStreamSource(audioStream).connect(analyser);
      analyserRef.current = analyser;
      const rec = new MediaRecorder(audioStream);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(250);
      s.current = { stream, ctx, rec, chunks, source: src, t0: performance.now(), pitches: [], win: [], flats: [], risks: [], riskPts: [], series: [], frames: 0, voiced: 0, lastRiskT: 0, smooth: null, raw: [], ticks: 0 };
      stream.getAudioTracks().forEach((t) => t.addEventListener("ended", () => stopRef.current()));
      s.current.timer = setInterval(tick, 50);
      setResult(null); setPitchSeries([]); setRiskSeries([]); setElapsed(0);
      setStatus("recording");
      log(src === "mic" ? "Microphone connected" : "Speaker output connected", "ok");
      log("Audio stream received", "ok");
    } catch (e) {
      const msg = e?.name === "NotAllowedError" ? "Permission denied - please allow access to continue." : e.message;
      toast.error(msg);
      log(`Capture failed: ${msg}`, "alert");
      setStatus("idle");
      setSource(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const reset = () => { setResult(null); setPitchSeries([]); setRiskSeries([]); setElapsed(0); setStatus("idle"); setLive({ hz: 0, level: 0, risk: null }); };

  const value = { status, source, elapsed, pitchSeries, riskSeries, live, result, logs, analyserRef, pitchRef, start, stop, reset, active: status === "recording" || status === "requesting" };
  return <RecorderCtx.Provider value={value}>{children}</RecorderCtx.Provider>;
}

export const useRecorder = () => useContext(RecorderCtx);
