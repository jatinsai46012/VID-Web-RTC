# Shared server-level settings, included from inside a `server {}` block by
# both site-http.conf and site-https.conf.

# The React bundle is 999 KB uncompressed; gzip takes it to ~300 KB.
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_vary on;
gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/manifest+json
    image/svg+xml
    application/xml;

# Audio uploads are a few MB at most. Anything much larger than this is a
# mistake, a runaway client, or an attack - so bound it here rather than in
# the application.
client_max_body_size 50m;

# These are inherited by every location block, because no location below
# declares `add_header` of its own. That is deliberate: adding a header at
# location level silently drops all inherited ones, which is an easy way to
# lose the security headers on exactly the routes you care about. Caching
# therefore uses `expires` rather than `add_header Cache-Control`.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
