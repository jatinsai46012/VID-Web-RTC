# syntax=docker/dockerfile:1
# ===========================================================================
#  VID web image: React build -> static files -> nginx edge
#
#      docker build -f frontend/Dockerfile -t vid-web .
#
#  Stage 1 compiles the app. Stage 2 is the public-facing nginx: it serves the
#  build, reverse-proxies /api to the `api` container and terminates TLS.
#  (One container rather than two, so the browser is always same-origin.)
# ===========================================================================


# --- stage 1: production build ---------------------------------------------
# `node:24-slim` rather than alpine: this stage is discarded in stage 2, so
# glibc costs nothing and avoids musl surprises in any transitive dependency.
# Node 24 matches the version the app is developed with.
FROM node:24-slim AS build

WORKDIR /app

# Empty REACT_APP_BACKEND_URL makes frontend/src/lib/api.js emit `/api`, so the
# browser calls the same host it loaded the page from and CORS never enters
# the picture. run.bat sets it to http://127.0.0.1:8001 for local dev instead.
# CI=false keeps ESLint warnings from failing the build the way they would on
# a CI runner; source maps are off because the source is already public.
ENV REACT_APP_BACKEND_URL=""
ENV CI=false
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY frontend/package.json frontend/yarn.lock ./

# packageManager pins yarn 1.22.22. Installing it explicitly avoids depending
# on whichever yarn (if any) ships with the Node image, and avoids corepack
# prompting for a download in a non-interactive build.
RUN npm install -g yarn@1.22.22 --no-audit --no-fund \
 && yarn install --frozen-lockfile --network-timeout 600000

COPY frontend/ ./

# Guard the one property that would silently break production: if the env var
# ever fails to reach the build, api.js produces the literal string
# "undefined/api" and every request 404s in a way that is hard to spot.
RUN yarn build \
 && if grep -rq "undefined/api" build/static/js/; then \
        echo "ERROR: REACT_APP_BACKEND_URL was not baked in as an empty string" \
        && exit 1; \
    fi


# --- stage 2: nginx edge ---------------------------------------------------
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

# The two full site configs plus the fragments they include.
COPY deploy/nginx/tpl/ /etc/nginx/tpl/

# Runs from the stock nginx entrypoint (/docker-entrypoint.d/) before nginx
# starts: picks site-https.conf once the certificate exists, site-http.conf
# until then. See deploy/nginx/render-site.sh.
COPY deploy/nginx/render-site.sh /docker-entrypoint.d/40-render-site.sh

# The nginx entrypoint only executes scripts that are executable, and git on
# Windows does not reliably preserve the execute bit. Normalise CRLF at the
# same time, for the same reason as the API image.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-render-site.sh \
 && chmod +x /docker-entrypoint.d/40-render-site.sh
