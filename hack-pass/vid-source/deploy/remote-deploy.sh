#!/bin/sh
# ===========================================================================
#  Deploy step that runs ON THE SERVER.
#
#  Invoked by .github/workflows/deploy.yml over ssh, and equally usable by
#  hand from the checkout:
#
#      cd /opt/vid/hack-pass/vid-source && ./deploy/remote-deploy.sh
#
#  Assumes: a clean `git pull` will succeed, `.env` exists next to
#  docker-compose.yml, and Docker Engine + the Compose plugin are installed.
# ===========================================================================
set -eu

cd "$(dirname "$0")/.."

echo "==> commit $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"

echo "==> git pull"
git pull --ff-only

echo "==> building images"
docker compose build

echo "==> starting the stack"
docker compose up -d --remove-orphans

echo "==> pruning dangling images"
docker image prune -f

# On the very first deploy the entrypoint downloads the 327 MB model before
# uvicorn even starts, so the API can legitimately take a minute to listen.
echo "==> waiting for the API (up to 3 minutes)"
ok=0
i=0
while [ "$i" -lt 36 ]; do
    if docker compose exec -T api curl -fsS http://127.0.0.1:8001/api/health; then
        echo
        ok=1
        break
    fi
    i=$((i + 1))
    sleep 5
done
if [ "$ok" != "1" ]; then
    echo "ERROR: the API never became healthy" >&2
    docker compose ps >&2
    docker compose logs --tail=80 api >&2
    exit 1
fi

echo "==> stack status"
docker compose ps

echo "==> edge check (nginx on :80)"
curl -sS -o /dev/null -w 'GET http://127.0.0.1/ -> %{http_code}\n' \
    http://127.0.0.1/ || echo "  (edge not answering on :80 yet)"
