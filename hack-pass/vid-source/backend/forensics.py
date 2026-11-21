import logging

from deepfake_model import predict_fake_probability

logger = logging.getLogger(__name__)


def heuristic_score(meta: dict) -> int:
    pitch_std = meta.get("pitch_std") or 0
    jitter = meta.get("jitter") or 0
    voiced = meta.get("voiced_ratio") or 0
    live = meta.get("live_risk_avg")
    if voiced < 0.05:
        return int(live) if live is not None else 50
    score = 10
    score += 30 if pitch_std < 10 else 15 if pitch_std < 20 else 0
    score += 30 if jitter < 0.006 else 12 if jitter < 0.015 else 0
    score += 10 if (meta.get("flatness") or 0) < 0.03 else 0
    if live is not None:
        score = int(0.5 * score + 0.5 * live)
    return max(0, min(100, int(score)))


def verdict_label(p: int) -> str:
    if p >= 65:
        return "deepfake"
    if p >= 35:
        return "suspicious"
    return "authentic"


def _signal_quality(meta: dict) -> str:
    voiced = meta.get("voiced_ratio") or 0
    if voiced >= 0.4:
        return "Good"
    if voiced >= 0.15:
        return "Fair"
    return "Poor"


def _summary(score: int, speech_detected: bool, ai_used: bool = False) -> str:
    if not speech_detected and not ai_used:
        return "Not enough speech was found to judge whether the voice is real."
    if score >= 65:
        return ("The AI model found strong signs that this voice is synthetic or cloned.")
    if score >= 35:
        return ("The AI model found some unusual patterns, but the recording is not clearly synthetic.")
    return ("The AI model found no meaningful signs of synthesis in this recording.")


def _indicators(meta: dict) -> list:
    """Plain-language findings derived from the client-side acoustic measurements."""
    out = []
    voiced = meta.get("voiced_ratio") or 0
    pitch_std = meta.get("pitch_std") or 0
    jitter = meta.get("jitter") or 0
    flatness = meta.get("flatness") or 0

    if voiced < 0.05:
        out.append({
            "label": "Speech detected",
            "status": "alert",
            "detail": "Almost no speech was found in this recording, so there is very little to analyse.",
        })
    elif voiced < 0.3:
        out.append({
            "label": "Speech detected",
            "status": "warning",
            "detail": "Only part of the recording contains speech, so background noise may affect the result.",
        })
    else:
        out.append({
            "label": "Speech detected",
            "status": "normal",
            "detail": "Plenty of clear speech was found to analyse.",
        })

    if pitch_std < 10:
        out.append({
            "label": "Pitch variation",
            "status": "alert",
            "detail": "The voice barely changes pitch. Real voices move up and down much more, which is a common sign of synthesis.",
        })
    elif pitch_std < 20:
        out.append({
            "label": "Pitch variation",
            "status": "warning",
            "detail": "The pitch is flatter than a typical natural voice, which can indicate cloned audio.",
        })
    else:
        out.append({
            "label": "Pitch variation",
            "status": "normal",
            "detail": "The pitch moves naturally, the way a real human voice does.",
        })

    if jitter < 0.006:
        out.append({
            "label": "Voice stability",
            "status": "alert",
            "detail": "The tone is unusually perfect and steady. Human voices always carry tiny natural wobbles.",
        })
    elif jitter < 0.015:
        out.append({
            "label": "Voice stability",
            "status": "warning",
            "detail": "The voice is smoother than average, which can happen in processed or generated audio.",
        })
    else:
        out.append({
            "label": "Voice stability",
            "status": "normal",
            "detail": "Natural micro-wobbles are present, as expected in a real human voice.",
        })

    if flatness < 0.03:
        out.append({
            "label": "Background noise",
            "status": "warning",
            "detail": "The audio is very clean with almost no background noise, which is common in generated speech.",
        })
    else:
        out.append({
            "label": "Background noise",
            "status": "normal",
            "detail": "Normal room noise is present, which you would expect from a real recording.",
        })

    return out[:5]


async def analyse(wav_path: str, meta: dict) -> dict:
    """Score a recording with the ONNX model, falling back to acoustic heuristics."""
    import asyncio

    model_p = await asyncio.to_thread(predict_fake_probability, wav_path)

    heur = heuristic_score(meta)
    speech_detected = (meta.get("voiced_ratio") or 0) > 0.05

    if model_p is not None:
        score = int(round(model_p * 100))
        ai_used = True
        confidence = int(round(max(model_p, 1.0 - model_p) * 100))
    else:
        score = heur
        ai_used = False
        confidence = 45

    result = {
        "deepfake_probability": score,
        "impersonation_probability": round(score * 0.8),
        "confidence": confidence,
        "signal_quality": _signal_quality(meta),
        "speech_detected": speech_detected,
        "summary": _summary(score, speech_detected, ai_used),
        "indicators": _indicators(meta),
        "transcript_snippet": "",
        "ai_used": ai_used,
    }
    result["heuristic_score"] = heur
    result["verdict"] = verdict_label(result["deepfake_probability"])
    if not speech_detected and result["verdict"] == "authentic":
        result["verdict"] = "suspicious"
    return result
