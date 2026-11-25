#!/bin/sh
# ===========================================================================
#  Daily synthetic check of the public deployment.
#
#      crontab -e
#      0 8 * * * sh /opt/vid/hack-pass/vid-source/deploy/monitor.sh >> /var/log/vid-monitor.log 2>&1
#
#  Two jobs in one: it tells you the moment the site stops answering (rather
#  than finding out when a recruiter clicks the link), and it gives the
#  instance a small burst of real work every day - a useful side effect on a
#  provider that reclaims chronically idle Always Free machines.
#
#  Run it after TLS is up; it probes https:// and will report failures while
#  the site is still plain HTTP.
# ===========================================================================
set -eu

cd "$(dirname "$0")/.."

DOMAIN="$(sed -n 's/^DOMAIN=//p' .env | tr -d '\r' | head -n 1)"
if [ -z "$DOMAIN" ]; then
    echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') config=FAIL (DOMAIN not set in .env)"
    exit 1
fi

ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
fail=0

if curl -fsS --max-time 20 -o /dev/null "https://$DOMAIN/"; then
    echo "$ts site=ok"
else
    echo "$ts site=FAIL"
    fail=1
fi

# /api/health answers 503 when MongoDB is down, and -f turns that into a
# failed check, so "green" means the whole stack is up and not just nginx.
if body="$(curl -fsS --max-time 25 "https://$DOMAIN/api/health")"; then
    echo "$ts api=ok $body"
else
    echo "$ts api=FAIL"
    fail=1
fi

exit "$fail"
