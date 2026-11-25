#!/bin/sh
# ===========================================================================
#  nginx site renderer - runs from the stock nginx entrypoint
#  (/docker-entrypoint.d/40-render-site.sh) BEFORE nginx starts.
#
#  Chooses the site config:
#
#    certificate present -> site-https.conf  (443 + ACME webroot on 80)
#    otherwise           -> site-http.conf   (80, app + ACME webroot)
#
#  The switch is re-evaluated on every container start, which is why issuing
#  the first certificate only needs `docker compose restart web` - no rebuild
#  and no hand-edited config.
# ===========================================================================
set -eu

TPL_DIR=/etc/nginx/tpl
OUT=/etc/nginx/conf.d/default.conf
DOMAIN="${DOMAIN:-}"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -n "$DOMAIN" ] && [ -f "$CERT" ]; then
    # Only ${DOMAIN} is substituted. Without the explicit variable list,
    # envsubst would also rewrite nginx's own $host/$uri/$request_uri and
    # produce a config that fails to start.
    envsubst '${DOMAIN}' < "$TPL_DIR/site-https.conf" > "$OUT"
    echo "40-render-site.sh: HTTPS enabled for $DOMAIN"
else
    cp "$TPL_DIR/site-http.conf" "$OUT"
    if [ -z "$DOMAIN" ]; then
        echo "40-render-site.sh: DOMAIN is not set - serving HTTP only" >&2
    else
        echo "40-render-site.sh: no certificate for $DOMAIN yet - serving HTTP only" >&2
        echo "40-render-site.sh: issue one with:" >&2
        echo "  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email <you> --agree-tos --no-eff-email" >&2
    fi
fi
