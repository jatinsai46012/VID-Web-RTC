#!/bin/sh
# ===========================================================================
#  First-time TLS issuance. Run it once the DNS A record for $DOMAIN already
#  points at this server and the stack is up:
#
#      cd /opt/vid/hack-pass/vid-source
#      sh deploy/issue-cert.sh
#
#  It reads DOMAIN and CERT_EMAIL straight out of .env (parsing rather than
#  sourcing, so a password with spaces or shell metacharacters cannot break
#  it), issues the certificate through the nginx webroot, then restarts the
#  web container so render-site.sh swaps in the HTTPS config.
#
#  Renewal is a different path - see the cron entry in DEPLOY.md.
# ===========================================================================
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
    echo "ERROR: .env not found next to docker-compose.yml." >&2
    echo "       cp .env.example .env   and fill it in first." >&2
    exit 1
fi

# .env is KEY=value; take the value verbatim, dropping any CR.
value_of() {
    sed -n "s/^$1=//p" .env | tr -d '\r' | head -n 1
}

DOMAIN="$(value_of DOMAIN)"
CERT_EMAIL="$(value_of CERT_EMAIL)"

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "vid.example.com" ]; then
    echo "ERROR: DOMAIN is unset or still the placeholder in .env" >&2
    exit 1
fi
if [ -z "$CERT_EMAIL" ] || [ "$CERT_EMAIL" = "you@example.com" ]; then
    echo "ERROR: CERT_EMAIL is unset or still the placeholder in .env" >&2
    exit 1
fi

echo "==> checking that $DOMAIN reaches this machine"
if ! curl -fsS --max-time 15 -o /dev/null "http://$DOMAIN/.well-known/acme-challenge/ping" 2>/dev/null; then
    echo "  (no answer yet - that is fine, certbot will report the details)"
fi

echo "==> requesting a certificate for $DOMAIN"
# --profile tls is belt-and-braces: explicitly targeting the service would
# activate its profile anyway, but spelling it out keeps this working across
# compose versions.
docker compose --profile tls run --rm certbot certonly --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$CERT_EMAIL" \
    --agree-tos \
    --no-eff-email

echo "==> restarting web so nginx picks the certificate up"
docker compose restart web

echo
echo "Done. Verify with:"
echo "  curl -sSI https://$DOMAIN/ | head -n 1"
