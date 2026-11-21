import os
import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response

JWT_ALGORITHM = "HS256"


def now():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _encode(payload: dict) -> str:
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def issue_session(response: Response, user_id: str):
    access = _encode({"sub": user_id, "type": "access", "exp": now() + timedelta(minutes=15)})
    refresh = _encode({"sub": user_id, "type": "refresh", "exp": now() + timedelta(days=7)})
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def set_access_cookie(response: Response, user_id: str):
    access = _encode({"sub": user_id, "type": "access", "exp": now() + timedelta(minutes=15)})
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")


def clear_session(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")


def token_from_request(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code.strip()}".encode()).hexdigest()


# Accounts allowed to download the source code - exactly these two by default.
# ADMIN_EMAILS (comma-separated) and the seeded ADMIN_EMAIL can add more via
# the environment without editing code. Nothing else grants access, not even a
# role="admin" flag on a user document.
DEFAULT_ADMIN_EMAILS = ("dhanush208.pj@gmail.com", "jatinsai46012@gmail.com")


def admin_emails() -> set:
    emails = {e.strip().lower() for e in DEFAULT_ADMIN_EMAILS}
    for key in ("ADMIN_EMAILS", "ADMIN_EMAIL"):
        emails.update(e.strip().lower() for e in os.environ.get(key, "").split(",") if e.strip())
    return emails


def is_admin(user: dict) -> bool:
    return (user.get("email") or "").strip().lower() in admin_emails()


def public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture"),
        "providers": user.get("providers", []),
        "has_password": bool(user.get("password_hash")),
        "created_at": user.get("created_at"),
        "is_admin": is_admin(user),
    }
