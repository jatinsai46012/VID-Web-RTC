# Shared location blocks, included from inside a `server {}` block by both
# site-http.conf and site-https.conf.


# --- API -------------------------------------------------------------------
# `proxy_pass` uses a VARIABLE, which makes nginx resolve `api` through
# Docker's embedded DNS on every request instead of once at startup. With a
# literal upstream nginx pins the container's IP address at boot, and every
# `docker compose up` that recreates the api container then leaves nginx
# proxying to a dead address - 502s until someone restarts nginx by hand.
#
# `set` is only valid in location/if/limit_except, hence it lives here too.
location /api/ {
    resolver 127.0.0.11 valid=10s ipv6=off;
    set $api_upstream http://api:8001;

    # No URI part on purpose: with a variable, nginx forwards the original
    # request path unchanged, so /api/... reaches FastAPI as /api/....
    proxy_pass $api_upstream;
    proxy_http_version 1.1;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;

    # Upload plus model inference on a long capture.
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}


# --- hashed static assets --------------------------------------------------
# Create React App fingerprints everything under /static/, so these responses
# can be cached forever without ever serving a stale file.
location /static/ {
    root /usr/share/nginx/html;
    expires 1y;
    access_log off;
}


# --- single-page application -----------------------------------------------
# Every unknown path falls through to index.html and lets react-router decide
# what to render, which is what makes a hard refresh on /dashboard work.
#
# index.html itself must NOT be cached, or a deploy would keep pointing
# browsers at bundle filenames that no longer exist. `expires -1` emits
# `Cache-Control: no-cache`.
location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
    expires -1;
}
