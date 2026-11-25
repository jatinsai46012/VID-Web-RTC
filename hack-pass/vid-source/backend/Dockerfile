# syntax=docker/dockerfile:1
# ===========================================================================
#  VID API image
#
#  Built from the vid-source/ directory (docker-compose.yml sets this up):
#      docker build -f backend/Dockerfile -t vid-api .
#
#  The 327 MB ONNX model is deliberately NOT baked in. It is fetched into the
#  `model-data` volume on first boot (deploy/api-entrypoint.sh), so image
#  rebuilds never re-download it and the image stays a few hundred MB.
# ===========================================================================

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# --- dependencies ----------------------------------------------------------
# build-essential exists only so that a wheel which happens to be missing for
# linux/arm64 can compile from source instead of failing the build. It is
# purged in the SAME layer, so the compiler never reaches the final image
# (apt's --auto-remove then takes gcc/g++/make with it).
# libsndfile1 is soundfile's fallback when its bundled copy is unavailable.
COPY backend/requirements.txt ./backend/requirements.txt
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        libsndfile1 \
 && pip install --no-cache-dir -r ./backend/requirements.txt \
 && apt-get purge -y --auto-remove build-essential \
 && rm -rf /var/lib/apt/lists/*

# --- startup helper --------------------------------------------------------
# CRLF in a shell script breaks it on Linux; normalise defensively because
# this repo is also checked out on Windows.
COPY deploy/fetch_model.py /usr/local/bin/fetch_model.py
COPY deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/api-entrypoint.sh \
 && chmod +x /usr/local/bin/api-entrypoint.sh

# --- application code ------------------------------------------------------
# `frontend/` and `design_guidelines.json` are shipped for one reason only:
# the admin-only /api/source/download endpoint zips `backend/` + `frontend/`
# from the project root, exactly as it does in local dev. The API never
# serves these files to anyone else, and node_modules/build/.venv/models are
# excluded by .dockerignore.
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY design_guidelines.json ./

# deepfake_model.py looks here first, and the compose file mounts the
# `model-data` volume at the same path.
ENV DEEPFAKE_MODEL_PATH=/app/backend/models/best_model.onnx

WORKDIR /app/backend

EXPOSE 8001

# start_period covers the one-off ~327 MB model download on first boot, and
# timeout is generous because the first /api/health call loads the model.
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8001/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
# --proxy-headers makes uvicorn honour X-Forwarded-Proto from nginx. The port
# is never published, so nginx is the only possible client and trusting
# forwarded headers is safe.
CMD ["python", "-m", "uvicorn", "server:app", \
     "--host", "0.0.0.0", "--port", "8001", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
