from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import json
import uuid
import logging
import zipfile
import tempfile
from datetime import timedelta
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import auth as A
from forensics import analyse
from email_service import send_otp_email

MONGO_URL = os.environ.get("MONGO_URL", "").strip()
if not MONGO_URL:
    raise RuntimeError(
        "MONGO_URL is not set. Set it in the environment or in backend/.env, e.g.:\n"
        "  MONGO_URL=mongodb://localhost:27017\n"
        "  DB_NAME=hackpass"
    )
DB_NAME = os.environ.get("DB_NAME", "hackpass").strip() or "hackpass"
client = AsyncIOMotorClient(MONGO_URL, uuidRepresentation="standard")
db = client[DB_NAME]

app = FastAPI(title="VID API")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


# ---------- models ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class OtpRequestIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)


class OtpVerifyIn(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    name: Optional[str] = Field(default=None, max_length=80)


# ---------- helpers ----------
async def get_current_user(request: Request) -> dict:
    payload = A.decode_token(A.token_from_request(request), "access")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def clean_email(raw: str) -> str:
    email = raw.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Please enter a valid email")
    return email


OTP_TTL = 600
OTP_COOLDOWN = 30


async def issue_otp(email: str) -> dict:
    existing = await db.otp_codes.find_one({"email": email}, {"_id": 0})
    ts = A.now().timestamp()
    if existing and ts - existing["created_at"] < OTP_COOLDOWN:
        wait = int(OTP_COOLDOWN - (ts - existing["created_at"]))
        raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting a new code")
    user = await db.users.find_one({"email": email}, {"_id": 0, "name": 1})
    code = A.new_otp()
    await db.otp_codes.update_one(
        {"email": email},
        {"$set": {"email": email, "code_hash": A.hash_otp(email, code), "created_at": ts, "expires_at": ts + OTP_TTL, "attempts": 0}},
        upsert=True,
    )
    try:
        await send_otp_email(email, code, (user or {}).get("name", ""))
    except HTTPException:
        await db.otp_codes.delete_one({"email": email})
        raise
    return {"stage": "otp", "email": email, "is_new": user is None, "expires_in": OTP_TTL, "resend_in": OTP_COOLDOWN}


async def check_lock(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if rec and rec.get("count", 0) >= MAX_ATTEMPTS:
        locked_at = rec["last"]
        if locked_at.tzinfo is None:
            locked_at = locked_at.replace(tzinfo=A.now().tzinfo)
        if A.now() - locked_at < timedelta(minutes=LOCK_MINUTES):
            raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {LOCK_MINUTES} minutes.")
        await db.login_attempts.delete_one({"identifier": identifier})


async def fail_attempt(identifier: str):
    await db.login_attempts.update_one({"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"last": A.now()}}, upsert=True)


async def clear_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ---------- auth routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = clean_email(body.email)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = {
        "user_id": A.new_user_id(), "email": email, "name": body.name.strip(),
        "password_hash": A.hash_password(body.password), "providers": ["email"],
        "email_verified": False, "created_at": A.now().isoformat(),
    }
    await db.users.insert_one(dict(user))
    return await issue_otp(email)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "x")
    ident = f"{ip}:{email}"
    await check_lock(ident)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not A.verify_password(body.password, user["password_hash"]):
        await fail_attempt(ident)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    await clear_attempts(ident)
    return await issue_otp(email)


@api.post("/auth/otp/request")
async def otp_request(body: OtpRequestIn):
    return await issue_otp(clean_email(body.email))


@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn, response: Response):
    email = clean_email(body.email)
    rec = await db.otp_codes.find_one({"email": email}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="No code requested. Please ask for a new code.")
    if A.now().timestamp() > rec["expires_at"]:
        await db.otp_codes.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="This code has expired. Please ask for a new one.")
    if rec.get("attempts", 0) >= 5:
        await db.otp_codes.delete_one({"email": email})
        raise HTTPException(status_code=429, detail="Too many wrong codes. Please ask for a new one.")
    if A.hash_otp(email, body.code) != rec["code_hash"]:
        await db.otp_codes.update_one({"email": email}, {"$inc": {"attempts": 1}})
        left = 4 - rec.get("attempts", 0)
        raise HTTPException(status_code=401, detail=f"Wrong code. {left} tries left." if left > 0 else "Wrong code. Please ask for a new one.")
    await db.otp_codes.delete_one({"email": email})
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "user_id": A.new_user_id(), "email": email, "name": (body.name or "").strip() or email.split("@")[0],
            "providers": ["email_otp"], "email_verified": True, "created_at": A.now().isoformat(),
        }
        await db.users.insert_one(dict(user))
    else:
        providers = sorted(set(user.get("providers", []) + ["email_otp"]))
        await db.users.update_one({"email": email}, {"$set": {"email_verified": True, "providers": providers}})
        user["providers"] = providers
    A.issue_session(response, user["user_id"])
    return {"user": A.public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return A.public_user(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = A.decode_token(token, "refresh")
    if not await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "user_id": 1}):
        raise HTTPException(status_code=401, detail="User not found")
    A.set_access_cookie(response, payload["sub"])
    return {"ok": True}


@api.post("/auth/logout")
async def logout(response: Response):
    A.clear_session(response)
    return {"ok": True}


# ---------- analyses ----------
@api.post("/analyses")
async def create_analysis(audio: UploadFile = File(...), meta: str = Form(...), user: dict = Depends(get_current_user)):
    try:
        m = json.loads(meta)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid metadata")
    data = await audio.read()
    if len(data) < 1000:
        raise HTTPException(status_code=422, detail="Recording is too short")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        result = await analyse(path, m)
    finally:
        os.unlink(path)
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["user_id"], "created_at": A.now().isoformat(),
        "source": m.get("source", "mic"), "duration": round(float(m.get("duration") or 0), 1),
        "title": m.get("title") or f"{'Speaker' if m.get('source') == 'speaker' else 'Mic'} capture",
        "metrics": {k: m.get(k) for k in ("pitch_mean", "pitch_std", "jitter", "flatness", "voiced_ratio", "live_risk_avg")},
        "pitch_series": (m.get("pitch_series") or [])[:400],
        "risk_series": (m.get("risk_series") or [])[:60],
        **result,
    }
    await db.analyses.insert_one(dict(doc))
    return doc


@api.get("/analyses")
async def list_analyses(verdict: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if verdict in ("authentic", "suspicious", "deepfake"):
        q["verdict"] = verdict
    return await db.analyses.find(q, {"_id": 0, "pitch_series": 0}).sort("created_at", -1).to_list(200)


@api.get("/analyses/stats")
async def stats(user: dict = Depends(get_current_user)):
    out = {"total": 0, "authentic": 0, "suspicious": 0, "deepfake": 0}
    async for row in db.analyses.aggregate([{"$match": {"user_id": user["user_id"]}}, {"$group": {"_id": "$verdict", "n": {"$sum": 1}}}]):
        out[row["_id"]] = row["n"]
        out["total"] += row["n"]
    return out


@api.get("/analyses/{aid}")
async def get_analysis(aid: str, user: dict = Depends(get_current_user)):
    doc = await db.analyses.find_one({"id": aid, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recording not found")
    return doc


@api.delete("/analyses/{aid}")
async def delete_analysis(aid: str, user: dict = Depends(get_current_user)):
    res = await db.analyses.delete_one({"id": aid, "user_id": user["user_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"ok": True}


# ---------- source code ----------
# Source only: no environments/caches, and none of the model weights
# (backend/models/*.onnx is >1 GB - see .gitignore, which also excludes it).
SKIP_DIRS = {"node_modules", "__pycache__", ".git", "build", ".cache", "test_reports",
             ".venv", ".pytest_cache", ".mypy_cache"}
SKIP_SUFFIXES = (".onnx",)


@api.get("/source/download")
async def download_source(user: dict = Depends(get_current_user)):
    if not A.is_admin(user):
        raise HTTPException(status_code=403, detail="Only admins can download the source code")
    base = ROOT_DIR.parent
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for folder in ("backend", "frontend"):
            for root, dirs, files in os.walk(base / folder):
                # Prune whole subtrees: walking node_modules or .venv just to
                # discard every file takes tens of seconds.
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                rel = Path(root).relative_to(base)
                for name in files:
                    if name.startswith(".env") or name == "yarn.lock" or Path(name).suffix in SKIP_SUFFIXES:
                        continue
                    z.write(Path(root) / name, f"vid/{rel / name}")
        for extra in ("design_guidelines.json", "README.md"):
            if (base / extra).exists():
                z.write(base / extra, f"vid/{extra}")
        z.writestr("vid/.env.example", "MONGO_URL=\nDB_NAME=\nJWT_SECRET=\nADMIN_EMAIL=\nADMIN_PASSWORD=\nADMIN_EMAILS=\nEMAIL_FROM_NAME=VID\nSMTP_HOST=\nSMTP_PORT=587\nSMTP_USER=\nSMTP_PASS=\nEMAIL_REPLY_TO=\nCORS_ORIGINS=\nREACT_APP_BACKEND_URL=\n")
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=vid-source.zip"})


@api.get("/")
async def root():
    return {"service": "VID", "status": "online"}


app.include_router(api)

# A wildcard origin is invalid together with allow_credentials: browsers reject
# Access-Control-Allow-Origin: * on any credentialed request, and the frontend
# calls the API with withCredentials: true. Starlette echoes the request origin
# on the preflight but emits a literal '*' on the real response, so an explicit
# allow-list is required for login to work cross-origin.
DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.analyses.create_index([("user_id", 1), ("created_at", -1)])
    await db.otp_codes.create_index("email", unique=True)

    # Legacy 2FA fields from an earlier schema; safe to clear on every boot.
    unset = {"totp_secret": "", "totp_enabled": "", "totp_temp_secret": "", "recovery_codes": ""}
    await db.users.update_many({}, {"$unset": unset})

    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "")
    logger.info("Source download restricted to admins: %s", ", ".join(sorted(A.admin_emails())))
    if not email or not pwd:
        logger.warning(
            "ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account was seeded. "
            "Add both to backend/.env to create one."
        )
        return

    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "user_id": A.new_user_id(), "email": email, "name": "VID Admin", "role": "admin",
            "password_hash": A.hash_password(pwd), "providers": ["email"], "email_verified": True,
            "created_at": A.now().isoformat(),
        })
        logger.info("Seeded admin account %s", email)
    elif existing.get("password_hash") and not A.verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": A.hash_password(pwd)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
