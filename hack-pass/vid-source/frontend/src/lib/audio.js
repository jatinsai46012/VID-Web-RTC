export const MAX_SECONDS = 30;

export const fmtTime = (s) => {
  const v = Math.max(0, Math.floor(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

export function detectPitch(input, sr) {
  // Decimate by 2 on high sample rates: 4x cheaper, still accurate for voice (60-450 Hz)
  let buf = input;
  if (sr > 30000) {
    buf = new Float32Array(input.length >> 1);
    for (let i = 0; i < buf.length; i++) buf[i] = (input[2 * i] + input[2 * i + 1]) * 0.5;
    sr /= 2;
  }
  const n = buf.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / n);
  if (rms < 0.008) return { hz: 0, rms };
  const minLag = Math.floor(sr / 450);
  const maxLag = Math.min(Math.floor(sr / 60), n - 2);
  const corr = new Float32Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += buf[i] * buf[i + lag];
    corr[lag] = s / (energy * ((n - lag) / n));
    if (lag <= maxLag && corr[lag] > best) best = corr[lag];
  }
  if (best < 0.45) return { hz: 0, rms };
  let lag = minLag;
  for (let l = minLag + 1; l <= maxLag; l++) {
    if (corr[l] >= 0.9 * best && corr[l] >= corr[l - 1] && corr[l] >= corr[l + 1]) { lag = l; break; }
  }
  const a = corr[lag - 1] || 0, b = corr[lag], c = corr[lag + 1] || 0;
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { hz: sr / (lag + (Number.isFinite(shift) ? shift : 0)), rms };
}

export function spectralFlatness(db) {
  let logSum = 0, sum = 0, count = 0;
  for (let i = 2; i < db.length / 2; i++) {
    const p = Math.pow(10, db[i] / 10);
    if (!Number.isFinite(p) || p <= 0) continue;
    logSum += Math.log(p);
    sum += p;
    count++;
  }
  if (!count || !sum) return 0;
  return Math.exp(logSum / count) / (sum / count);
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const jitterOf = (a) => {
  if (a.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < a.length; i++) d += Math.abs(a[i] - a[i - 1]);
  return d / (a.length - 1) / (mean(a) || 1);
};

export function windowRisk(pitches, flatness) {
  if (pitches.length < 3) return null;
  const s = std(pitches), j = jitterOf(pitches);
  let score = 6;
  score += s < 6 ? 40 : s < 12 ? 26 : s < 20 ? 14 : 4;
  score += j < 0.005 ? 34 : j < 0.012 ? 20 : j < 0.025 ? 9 : 3;
  score += flatness < 0.02 ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

export function aggregate(pitches, flats, voicedRatio) {
  return {
    pitch_mean: Math.round(mean(pitches) || 0),
    pitch_std: +std(pitches).toFixed(2),
    jitter: +jitterOf(pitches).toFixed(4),
    flatness: +mean(flats).toFixed(4),
    voiced_ratio: +voicedRatio.toFixed(3),
  };
}

function pcmToWav(samples, sr) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToWav(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const sr = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * sr), sr);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return { wav: pcmToWav(rendered.getChannelData(0), sr), duration: decoded.duration };
}
