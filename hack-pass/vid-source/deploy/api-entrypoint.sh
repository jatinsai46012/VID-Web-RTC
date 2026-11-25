#!/bin/sh
# ===========================================================================
#  VID API entrypoint
#
#  Fetches the ONNX model into the model-data volume on first boot, then hands
#  off to uvicorn. A failed download is a warning, not a fatal error: the API
#  starts anyway on the acoustic heuristics, so a missing or unpublished
#  release asset can never take the demo down.
#
#  The model is stored in a VOLUME, not in the image, so `docker compose build`
#  never re-downloads 327 MB and the weights survive rebuilds.
# ===========================================================================
set -eu

MODEL_PATH="${DEEPFAKE_MODEL_PATH:-/app/backend/models/best_model.onnx}"

if [ "${VID_SKIP_MODEL_DOWNLOAD:-}" = "1" ]; then
    echo "[entrypoint] VID_SKIP_MODEL_DOWNLOAD=1 - not fetching the model."
elif [ -f "$MODEL_PATH" ]; then
    echo "[entrypoint] model present at $MODEL_PATH"
else
    echo "[entrypoint] model missing - fetching it (first boot only, ~327 MB)..."
    if ! python /usr/local/bin/fetch_model.py; then
        echo "[entrypoint] WARNING: could not fetch the model weights."
        echo "[entrypoint]          The API will start with the acoustic"
        echo "[entrypoint]          heuristics instead of the ONNX classifier."
    fi
fi

exec "$@"
