"""Download and verify the ONNX model inside the API container.

Mirror of run.bat's ``:ensure_model`` on Windows: fetch the weights from the
GitHub release, check the SHA-256 before trusting a 327 MB blob, and never
leave a partial file behind. Any failure exits non-zero - the entrypoint then
starts the API on the acoustic heuristics instead, so a missing or unpublished
release asset can never take the service down.

MODEL_URL / MODEL_SHA come from docker-compose.yml and can be overridden in
.env when the weights are republished.
"""

import hashlib
import os
import sys
import urllib.error
import urllib.request

MODEL_URL = os.environ.get(
    "MODEL_URL",
    "https://github.com/jatinsai46012/VID-Web-RTC/releases/download/v1.0.0/best_model.onnx",
)
MODEL_SHA = os.environ.get(
    "MODEL_SHA",
    "30FFE8F5B73A68420337D13172E306692CC679D1BCAC9404BFFA542D945EBDF6",
).strip().lower()
TARGET = os.environ.get("DEEPFAKE_MODEL_PATH", "/app/backend/models/best_model.onnx")

CHUNK = 1 << 20          # 1 MiB
REPORT_EVERY = 50 << 20  # log progress every 50 MB so `docker logs` shows life
USER_AGENT = "vid-model-fetch/1.0"


def log(msg):
    print("[fetch_model] " + msg, flush=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest):
    """Stream url into dest, printing a progress marker every 50 MB."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    total = 0
    next_report = REPORT_EVERY
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as out:
        while True:
            chunk = resp.read(CHUNK)
            if not chunk:
                break
            out.write(chunk)
            total += len(chunk)
            if total >= next_report:
                log("  ... %d MB" % (total >> 20))
                next_report += REPORT_EVERY
    return total


def main():
    if not MODEL_URL.startswith(("http://", "https://")):
        log("MODEL_URL is not an http(s) URL: %r" % MODEL_URL)
        return 1

    os.makedirs(os.path.dirname(TARGET) or ".", exist_ok=True)

    # Already on disk? Verify rather than assume - a truncated file from an
    # interrupted earlier boot must not be mistaken for a good model.
    if os.path.isfile(TARGET):
        if not MODEL_SHA:
            log("MODEL_SHA is not set - trusting the file already on disk")
            return 0
        actual = sha256(TARGET)
        if actual == MODEL_SHA:
            log("model already present and verified (%d MB)"
                % (os.path.getsize(TARGET) >> 20))
            return 0
        log("existing model failed its checksum (%s...); re-downloading"
            % actual[:16])

    part = TARGET + ".part"
    if os.path.exists(part):
        os.remove(part)

    log("downloading %s" % MODEL_URL)
    try:
        size = download(MODEL_URL, part)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            log("HTTP 404 - the release asset has not been published yet.")
            log("Publish best_model.onnx on the v1.0.0 release, or set")
            log("VID_SKIP_MODEL_DOWNLOAD=1 to silence this.")
        else:
            log("download failed: HTTP %s %s" % (e.code, e.reason))
        if os.path.exists(part):
            os.remove(part)
        return 1
    except Exception as e:  # network, disk, timeout - all recoverable here
        log("download failed: %s: %s" % (type(e).__name__, e))
        if os.path.exists(part):
            os.remove(part)
        return 1

    if size == 0:
        log("download produced an empty file")
        os.remove(part)
        return 1

    if MODEL_SHA:
        log("verifying sha256 of %d MB ..." % (size >> 20))
        actual = sha256(part)
        if actual != MODEL_SHA:
            log("checksum mismatch - expected %s..., got %s..."
                % (MODEL_SHA[:16], actual[:16]))
            log("discarding it: the download may be truncated")
            os.remove(part)
            return 1
    else:
        log("MODEL_SHA is not set - skipping verification")

    # Atomic: the real filename only ever appears once it is complete.
    os.replace(part, TARGET)
    log("model ready at %s" % TARGET)
    return 0


if __name__ == "__main__":
    sys.exit(main())
