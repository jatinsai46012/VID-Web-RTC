"""ONNX deepfake detector.

Wraps the HuggingFace `best_model.onnx` binary classifier: 16 kHz mono audio,
padded/truncated to 3 seconds, z-score normalised, softmax over 2 logits.

The session is loaded once on first use and reused. If the model file is
missing or fails to load, every call returns None so callers can fall back to
the acoustic heuristics instead of erroring out.
"""

import os
import threading

import numpy as np

MAX_LEN = 48000  # 3 seconds at 16 kHz

_MODEL_FILENAME = "best_model.onnx"
_CANDIDATES = (
    os.path.join(os.path.dirname(__file__), "models", _MODEL_FILENAME),
    os.path.join(os.path.dirname(__file__), _MODEL_FILENAME),
)

_lock = threading.Lock()
_session = None
_resolved_path: str | None = None
_provider: str | None = None
_load_failed = False


def _find_model() -> str | None:
    override = os.environ.get("DEEPFAKE_MODEL_PATH")
    if override:
        return override if os.path.isfile(override) else None
    for path in _CANDIDATES:
        if os.path.isfile(path):
            return path
    return None


def _open_session(path: str, providers):
    """Try the given providers, falling back to CPU-only on failure."""
    import onnxruntime as ort

    available = ort.get_available_providers()
    chosen = [p for p in providers if p in available] or ["CPUExecutionProvider"]
    if "CPUExecutionProvider" not in chosen:
        chosen.append("CPUExecutionProvider")

    try:
        session = ort.InferenceSession(path, providers=chosen)
    except Exception:
        session = ort.InferenceSession(path)
        return session, "CPUExecutionProvider"
    # Ask the session which provider actually took the graph, since a provider
    # can be silently ignored when its required libs are missing.
    return session, session.get_providers()[0]


def _get_session():
    """Return the cached (session, provider), or None if unavailable."""
    global _session, _provider, _load_failed
    if _session is not None:
        return _session
    if _load_failed:
        return None
    with _lock:
        if _session is not None:
            return _session
        path = _find_model()
        if not path:
            _load_failed = True
            return None
        try:
            import onnxruntime  # noqa: F401
        except ImportError:
            _load_failed = True
            return None
        try:
            _session, _provider = _open_session(
                path,
                [
                    "TensorrtExecutionProvider",
                    "CUDAExecutionProvider",
                    "DmlExecutionProvider",
                    "CPUExecutionProvider",
                ],
            )
            _resolved_path = path
        except Exception:
            _load_failed = True
            return None
        return _session


def model_status() -> dict:
    """Diagnostic detail for the API, without loading the model if absent."""
    path = _find_model()
    session = _get_session()
    return {
        "available": session is not None,
        "path": _resolved_path or path,
        "loaded": session is not None,
        "provider": _provider,
    }


STRIDE = MAX_LEN          # non-overlapping 3 s windows
MAX_WINDOWS = 12          # cap so a long capture cannot stall the request
SILENCE_RMS = 1e-4        # below this a window is treated as silence


def _run_window(session, y: np.ndarray) -> float:
    y = (y - np.mean(y)) / np.sqrt(np.var(y) + 1e-5)
    y = y.astype(np.float32).reshape(1, MAX_LEN)
    input_name = session.get_inputs()[0].name
    logits = session.run(None, {input_name: y})[0]
    # Softmax, shifted by the max so large logits cannot overflow to NaN.
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    exp = np.exp(shifted)
    probs = exp / np.sum(exp, axis=1, keepdims=True)
    return float(probs[0][1])


def predict_fake_probability(wav_path: str) -> float | None:
    """Return P(deepfake) in [0, 1], or None if the model cannot run.

    The model only ever sees 3 seconds of audio, so judging a recording by its
    first 3 s means judging it by whatever happened to arrive first - usually
    silence in a live capture, which the model calls "real" at ~99.99%
    confidence. So slide a window across the whole recording, skip windows that
    contain no signal, and report the highest P(fake) found anywhere.
    """
    session = _get_session()
    if session is None or not wav_path:
        return None
    try:
        # Same thing librosa.load(path, sr=16000, mono=True) does for a WAV:
        # decode, downmix to mono, resample to 16 kHz. soundfile + soxr are
        # librosa's own backends anyway, minus the numba/scipy dependency tree.
        import soundfile as sf
        import soxr
    except ImportError:
        return None
    try:
        data, sr = sf.read(wav_path, dtype="float32", always_2d=True)
    except Exception:
        return None
    if data.size == 0:
        return None
    y = data.mean(axis=1)
    if sr != 16000:
        try:
            y = soxr.resample(y, sr, 16000)
        except Exception:
            return None

    starts = list(range(0, max(y.size - MAX_LEN + 1, 1), STRIDE))
    if len(starts) > MAX_WINDOWS:
        step = len(starts) / MAX_WINDOWS
        starts = [starts[int(i * step)] for i in range(MAX_WINDOWS)]

    best = None
    for offset in starts:
        window = y[offset: offset + MAX_LEN]
        if window.size < MAX_LEN:
            window = np.pad(window, (0, MAX_LEN - window.size))
        # Silence carries no evidence, and the model reads it as "real".
        if np.sqrt(np.mean(window ** 2)) < SILENCE_RMS:
            continue
        try:
            p = _run_window(session, window)
        except Exception:
            return None
        best = p if best is None else max(best, p)
    return best
