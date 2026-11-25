# Deploying VID to Oracle Cloud (Always Free)

A complete walkthrough for taking the app from `run.bat` on Windows to a public
HTTPS URL that stays up, costs nothing, and does not sleep on a recruiter.

- **Target:** Oracle Cloud Always Free VM (Ubuntu 24.04, ARM)
- **Cost:** $0/month, no expiry date
- **Stack:** nginx + FastAPI/uvicorn + MongoDB, all in Docker Compose
- **Estimated time:** 45–60 minutes the first time (most of it is signup and DNS)

---

## 1. Architecture

```
                     Internet
                        |
                   :80 / :443
                        v
        +-------------------------------+
        |  web        (nginx:alpine)    |  serves the React build
        |  TLS termination, /api proxy  |  issues & renews certificates
        +---------------+---------------+
                        |  internal bridge network `vid`
        +---------------+---------------+        +--------------------+
        |  api  (python:3.11-slim)     |<------>|  mongo (mongo:7)   |
        |  uvicorn + ONNX inference    | 27017  |  users, analyses   |
        +---------------+---------------+        +--------------------+
                        |
              model-data volume
              best_model.onnx (327 MB, fetched once, SHA-256 verified)
```

Three properties this design is built around:

| Property | Why it is not optional |
| --- | --- |
| **HTTPS** | `auth.py` sets cookies with `secure=True` and the recorder calls `getUserMedia`. On plain HTTP, login silently fails and the microphone never opens. |
| **Same origin** | The production build bakes `REACT_APP_BACKEND_URL=""` into the bundle, so the browser calls `/api` on the host it loaded from. CORS never enters the picture. |
| **≥1 GB RAM** | The int8 model peaks around 600–800 MB with the interpreter and ONNX Runtime. Anything capped at 512 MB OOMs. |

No WebSockets anywhere, so nginx needs no upgrade-proxying tricks.

---

## 2. Before you start — the release asset

The ONNX model is 327 MB and cannot live in git (GitHub rejects files over
100 MB). It ships as a **release asset** and is downloaded on first boot.

**If you have not uploaded it yet, do that first** — otherwise the container
starts, logs a warning, and runs on the acoustic heuristics only.

1. Open <https://github.com/jatinsai46012/VID-Web-RTC/releases/new?tag=v1.0.0>
2. Title: `v1.0.0`
3. Drag in `hack-pass/vid-source/backend/models/best_model.onnx` (327.1 MB)
4. **Publish release** and keep the tab open until the upload finishes

The filename must stay exactly `best_model.onnx`. Verify it worked:

```bash
curl -sIL https://github.com/jatinsai46012/VID-Web-RTC/releases/download/v1.0.0/best_model.onnx | head -n 1   # expect: HTTP/2 200
```

---

## 3. Prerequisites

| Thing | Notes |
| --- | --- |
| **Oracle Cloud account** | Free tier signup needs a credit card and is historically picky about approval. Use your real details; a mismatch usually means instant rejection. |
| **A domain name** | Required for TLS. **A free [duckdns.org](https://www.duckdns.org) subdomain works fine** and takes about two minutes — just set its A record to your server's public IP. Any domain you already own works too. |
| **This repo cloned** | `git clone https://github.com/jatinsai46012/VID-Web-RTC.git` |

---

## 4. Create the VM

In the Oracle Cloud console: **Compute → Instances → Create instance**.

| Setting | Value |
| --- | --- |
| Name | `vid` |
| Image | **Ubuntu 24.04** (aarch64/ARM) — *not* the generic x86 image |
| Shape | **VM.Standard.A1.Flex** → **2 OCPU, 12 GB RAM** (the Always Free allowance) |
| VCN | *Create new VCN* → *Create* (public subnet) |
| Boot volume | 47 GB default is plenty; images + model need under 5 GB |
| SSH key | Upload a public key, or download the `.pem` Oracle generates for you |

Two things people trip over:

- **Always Free instances must live in your home region.** Pick it at signup
  and create the instance there.
- **Public IPv4** must be assigned (it is, by default, on a public subnet).

### Open the firewall

Instance → **Subnet** link → **Default Security List** → **Add ingress rules**:

| Source | Protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |
| `Your home/office IP` | TCP | 22 |

Restricting 22 to your own IP is worth doing; 80/443 must be open to the world.

Note: Oracle blocks **outbound port 25** on all instances. That does not affect
OTP email, which uses 587 — but do not set `SMTP_PORT=25`.

---

## 5. Point DNS at the server

Create an **A record** for your hostname → the instance's public IPv4 address.

```
TYPE  NAME              VALUE
A     vid.duckdns.org   129.146.x.x
```

It has to be resolving **before** step 8 — Let's Encrypt validates by fetching
`http://<your-domain>/.well-known/acme-challenge/...` from the public internet.

```bash
nslookup vid.duckdns.org     # must return your server IP
```

---

## 6. Install Docker and clone

SSH in as `ubuntu` (or `opc`, depending on the image you chose):

```bash
# Windows (OpenSSH is built in):
ssh -i C:\path\to\ssh-key.pem ubuntu@129.146.x.x

# Install Docker Engine + the Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Sanity check — should print the server version, with no sudo
docker version --format '{{.Server.Version}}'
docker compose version

# Clone
sudo mkdir -p /opt/vid && sudo chown "$USER" /opt/vid
git clone https://github.com/jatinsai46012/VID-Web-RTC.git /opt/vid
cd /opt/vid/hack-pass/vid-source
```

`DEPLOY_PATH` for the CI secret in step 11 is therefore
`/opt/vid/hack-pass/vid-source`.

---

## 7. Configure

```bash
cd /opt/vid/hack-pass/vid-source
cp .env.example .env
nano .env
```

`.env` is gitignored — the real values never enter the repository.

| Variable | What to put |
| --- | --- |
| `DOMAIN` | your hostname, no scheme (`vid.duckdns.org`) |
| `CERT_EMAIL` | an inbox you actually read — Let's Encrypt sends expiry warnings |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the admin account, seeded on first boot |
| `SMTP_*` | optional — leave empty to disable OTP login (password login still works) |

Everything else has a working default.

---

## 8. First boot (HTTP)

```bash
docker compose up -d
docker compose ps
docker compose logs -f api       # Ctrl-C stops following, not the container
```

The first build takes several minutes: it installs Python packages and runs a
full production React build. On the very first start the API also downloads the
327 MB model into the `model-data` volume before uvicorn begins listening —
that is why `api` may sit in `starting` for a minute or two.

Wait for it, then check:

```bash
docker compose exec api curl -fsS http://127.0.0.1:8001/api/health
```

Expected:

```json
{"service":"VID","status":"online","database":"up","model":{"available":true,"loaded":true,"provider":"CPUExecutionProvider"}}
```

`"available":false` means the release asset from step 2 is still missing.

The site should now be reachable at `http://<your-ip>/` — but **login and the
microphone will not work yet**, because there is no TLS. That is expected.

---

## 9. Issue the TLS certificate

```bash
cd /opt/vid/hack-pass/vid-source
sh deploy/issue-cert.sh
```

This reads `DOMAIN` and `CERT_EMAIL` from `.env`, runs
`certbot certonly --webroot` against the nginx webroot, and restarts the `web`
container. On restart `render-site.sh` notices the certificate and swaps in the
HTTPS configuration — no rebuild, no hand-edited config.

Verify:

```bash
curl -sSI https://<your-domain>/ | head -n 1     # HTTP/2 200
curl -sS  https://<your-domain>/api/health
```

Then open the site in a browser and confirm the padlock. **Login, OTP email and
microphone capture should all work now** — if the microphone prompt does not
appear, you are not actually on HTTPS; check the URL bar.

---

## 10. Renewal and monitoring

```bash
crontab -e
```

```cron
# Renew the certificate nightly and reload nginx with zero downtime.
# `nginx -s reload` re-reads the certificate without dropping connections.
0 3 * * * cd /opt/vid/hack-pass/vid-source && docker compose run --rm certbot renew --quiet && docker compose exec -T web nginx -s reload >> /var/log/vid-cert.log 2>&1

# Daily synthetic check of the public site + API, logged to /var/log/vid-monitor.log
0 8 * * * sh /opt/vid/hack-pass/vid-source/deploy/monitor.sh >> /var/log/vid-monitor.log 2>&1
```

Let's Encrypt certificates last 90 days and are renewed automatically from day
30 onward. Test the renewal path whenever you like — it is the same command
cron runs:

```bash
docker compose run --rm certbot renew --dry-run
```

---

## 11. Optional: deploy from GitHub Actions

Pushing to `main` does **not** touch production by itself. To enable one-click
deploys from the Actions tab, add four secrets under
**Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the server's public IP |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_KEY` | the private key (`cat ~/.ssh/id_ed25519`, no passphrase) |
| `DEPLOY_PATH` | `/opt/vid/hack-pass/vid-source` |

Then run **Deploy → Run workflow**. It SSHes in, runs
`deploy/remote-deploy.sh`, and refuses to report success until
`/api/health` answers — on the first deploy that includes waiting for the model
download.

The `CI` workflow runs on every push regardless: Python 3.11 import checks, a
production React build with the same flags as the Docker image, and a build of
both images.

---

## 12. Day-2 operations

```bash
cd /opt/vid/hack-pass/vid-source

docker compose ps                       # what is running / healthy
docker compose logs -f api              # tail the API
docker compose logs -f web              # nginx access + error logs
docker compose restart api              # restart one service
docker compose exec api python          # shell into the API container

git pull --ff-only && docker compose build && docker compose up -d   # deploy a change
docker image prune -f                   # reclaim layers left by rebuilds
```

**Backup:** the only state is the `mongo-data` volume (users + analyses).

```bash
docker compose exec -T mongo mongodump --archive --gzip > vid-db-$(date +%F).archive.gz
```

Restore is `mongorestore --archive --gzip --drop < file`. Copy the archive off
the VM — a backup that only exists on the machine it protects is not a backup.

**Teardown:** delete the instance in the console. To start over without
deleting it: `docker compose down -v` (this **destroys** the database, the
model and the certificates).

---

## 13. Always Free idle reclamation — the honest version

Oracle reclaims Always Free instances whose CPU, memory and network all sit
below 20% for roughly a week, and may treat an account that is idle for 30+
days as abandoned. A resume demo is close to the worst case: a mostly idle box.

What helps, in order of usefulness:

1. **The daily monitor in step 10.** Real traffic, and it tells you the moment
   the site stops answering.
2. **Occasionally using it** — clicking through the demo, redeploying after a
   push. Genuine activity is the signal Oracle actually looks for.
3. **Keeping the account active** by signing into the console every few weeks.

What does *not* work: a tiny HTTP keep-alive. It moves a rounding error's worth
of CPU and will not clear a 20% threshold.

**The mitigation that does work is that everything is in git.** If the instance
is reclaimed, sections 4–9 rebuild it in about fifteen minutes. Treat reclamation
as an inconvenience, not a catastrophe, and do not spend effort engineering
around it.

---

## 14. Troubleshooting

**`docker compose up` fails with "JWT_SECRET is required"**
`.env` is missing or empty. `cp .env.example .env`, fill it in.

**nginx exits immediately, `docker compose logs web` shows a config error**
Almost always a missing or malformed certificate file. Check:
`docker compose exec web ls -l /etc/letsencrypt/live/$DOMAIN/`
Then re-run `sh deploy/issue-cert.sh`.

**`certbot` errors with "urn:ietf:params:acme:error:unauthorized" or DNS errors**
The A record is not resolving, not pointing at this server, or propagation has
not finished. `nslookup <your-domain>` must return the server's IP, and
`curl -v http://<your-domain>/` from your laptop must reach nginx.

**The API stays `unhealthy`**
```bash
docker compose logs --tail=100 api
docker compose exec api curl -sS http://127.0.0.1:8001/api/health
```
- `"database":"down"` → Mongo did not start: `docker compose logs mongo`
- `"model":{"available":false}` → the release asset is missing (step 2)
- container restarts in a loop → `pip` failed to find a wheel; the image
  installs a compiler for exactly this case, so look for a genuine build error
  in the logs rather than a missing package

**Login works but OTP email never arrives**
Test SMTP from the server itself before debugging the app:
```bash
docker compose exec api python - <<'PY'
import os, smtplib
s = smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", 587)))
s.starttls(); s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
s.sendmail(os.environ["SMTP_USER"], os.environ["SMTP_USER"], "Subject: test\n\nok")
print("sent")
PY
```
Many providers block ranges of cloud IPs. If this fails, switch provider or
leave `SMTP_*` empty — password login still works, so the demo is unaffected.

**Site loads but every API call 404s or CORS-fails**
The bundle was built without `REACT_APP_BACKEND_URL=""`. CI checks for this
(`undefined/api` in the bundle). Rebuild:
```bash
docker compose build web && docker compose up -d web
```

**Deployed but the browser still shows the old version**
`index.html` is served with `Cache-Control: no-cache`, but a hard refresh
(`Ctrl+Shift+R`) is the reliable answer right after a deploy.
