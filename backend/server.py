# ─── Merawala Dashboard Backend ───
# Synced with Player App (monetavideo) — Same MongoDB Atlas (merewala_db)

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import uuid
import secrets
import random
import string
import hashlib
import httpx
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional

# ─── Config ───
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
EARNING_PER_VIEW_FIRST = 0.001  # $1 CPM (first 1000 views)
EARNING_PER_VIEW_AFTER = 0.002  # $2 CPM (after 1000 views)
DEFAULT_CPM = 2.0               # Default global CPM ($2)
VIEW_COOLDOWN_SECONDS = 300     # 5 min cooldown per IP+video

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Helpers ───
def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def generate_code(length=10):
    """Generate unique video code for share links"""
    return uuid.uuid4().hex[:length]

def generate_api_key():
    return f"ms_{secrets.token_hex(24)}"

def get_viewer_fingerprint(request: Request):
    """Create fingerprint from IP + User-Agent for anti-fraud"""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "unknown")
    raw = f"{ip}:{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

async def get_global_cpm():
    """Get global CPM from settings collection"""
    settings = await db.settings.find_one({"key": "global_cpm"}, {"_id": 0})
    if settings:
        return settings.get("value", DEFAULT_CPM)
    return DEFAULT_CPM

async def get_current_user(request: Request) -> dict:
    # Check session_token cookie (Google Auth)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    user.pop("password_hash", None)
                    return user

    # Check JWT access_token cookie or Bearer header
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Could be a session token
            session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
            if session:
                expires_at = session.get("expires_at")
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at and expires_at > datetime.now(timezone.utc):
                    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                    if user:
                        user.pop("password_hash", None)
                        return user

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── Pydantic Models ───
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class LinkCreate(BaseModel):
    title: str
    original_url: str

class LinkUpdate(BaseModel):
    title: Optional[str] = None
    original_url: Optional[str] = None

class WithdrawRequest(BaseModel):
    method: str
    amount: float
    details: dict

class GenerateLinkInput(BaseModel):
    api_key: str
    file_id: str
    file_name: str = "Untitled Video"
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None

class ViewInput(BaseModel):
    video_id: str
    watch_duration: int = 0

class UpdateViewsInput(BaseModel):
    video_id: str
    watch_percentage: float = 0

class AdminVideoAction(BaseModel):
    video_id: str
    action: str  # approve, reject, delete

class AdminCPMUpdate(BaseModel):
    cpm: float

class AdminSubscriptionUpdate(BaseModel):
    user_id: str
    subscription: str  # free, basic, premium

class AdminSettingsUpdate(BaseModel):
    allow_download: Optional[bool] = None

# ═══════════════════════════════════════
#  AUTH ROUTES
# ═══════════════════════════════════════

@api_router.post("/auth/register")
async def register(input_data: RegisterInput, response: Response):
    email = input_data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": input_data.name,
        "password_hash": hash_password(input_data.password),
        "role": "user", "subscription": "free", "balance": 0.0,
        "api_key": generate_api_key(), "created_at": datetime.now(timezone.utc),
    })
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"user_id": user_id, "email": email, "name": input_data.name, "role": "user"}

@api_router.post("/auth/login")
async def login(input_data: LoginInput, request: Request, response: Response):
    email = input_data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        await db.login_attempts.update_one({"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(input_data.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_many({"identifier": identifier})
    user_id = user.get("user_id", str(user.get("_id", "")))
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"user_id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(payload["sub"], user["email"])
        response.set_cookie(key="access_token", value=new_access, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# Google OAuth session exchange
@api_router.post("/auth/google/session")
async def google_session_exchange(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": session_id})
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()
    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token", "")
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing.get("user_id", str(existing.get("_id", "")))
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "role": "user", "subscription": "free", "balance": 0.0,
            "api_key": generate_api_key(), "created_at": datetime.now(timezone.utc),
        })
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    access_token = create_access_token(user_id, email)
    refresh_token_val = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token_val, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user.pop("password_hash", None)
    return user

# ═══════════════════════════════════════
#  LINKS CRUD (existing feature)
# ═══════════════════════════════════════

@api_router.post("/links")
async def create_link(link: LinkCreate, request: Request):
    user = await get_current_user(request)
    short_code = generate_code(8)
    link_doc = {
        "link_id": str(uuid.uuid4()), "user_id": user["user_id"],
        "title": link.title, "original_url": link.original_url,
        "short_code": short_code, "views": 0, "earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.links.insert_one(link_doc)
    link_doc.pop("_id", None)
    return link_doc

@api_router.get("/links")
async def get_links(request: Request, search: str = ""):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    return await db.links.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.put("/links/{link_id}")
async def update_link(link_id: str, link: LinkUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in link.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.links.update_one({"link_id": link_id, "user_id": user["user_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return await db.links.find_one({"link_id": link_id}, {"_id": 0})

@api_router.delete("/links/{link_id}")
async def delete_link(link_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.links.delete_one({"link_id": link_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"message": "Link deleted"}

# ═══════════════════════════════════════
#  VIDEO SYSTEM (Synced with Player App)
# ═══════════════════════════════════════

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
BASE_URL = os.environ.get("FRONTEND_URL", "https://merawala.xyz")

async def get_telegram_file_url(file_id: str) -> str:
    """Get download URL from Telegram file_id"""
    if not TELEGRAM_TOKEN or not file_id:
        return None
    try:
        async with httpx.AsyncClient() as http:
            resp = await http.get(f"{TELEGRAM_API}/getFile", params={"file_id": file_id})
            data = resp.json()
            if data.get("ok"):
                return f"https://api.telegram.org/file/bot{TELEGRAM_TOKEN}/{data['result']['file_path']}"
    except Exception as e:
        logger.error(f"Telegram getFile error: {e}")
    return None

# POST /api/generate-link — Bot/API creates video entry
@api_router.post("/generate-link")
async def generate_link(input_data: GenerateLinkInput):
    """Bot calls this to create a video entry and get shareable link"""
    user = await db.users.find_one({"api_key": input_data.api_key}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")

    code = generate_code(10)
    video_url = await get_telegram_file_url(input_data.file_id)
    share_link = f"{BASE_URL}/watch/{code}"

    video_doc = {
        "code": code,
        "video_id": code,  # alias for compatibility
        "shareLink": share_link,
        "title": input_data.title or input_data.file_name,
        "description": input_data.description or "",
        "thumbnail": input_data.thumbnail or "",
        "videoUrl": video_url or "",
        "file_id": input_data.file_id,
        "file_name": input_data.file_name,
        "views": 0,
        "validViews": 0,
        "earnings": 0.0,
        "status": "approved",  # auto-approve bot uploads
        "ownerId": user["user_id"],
        "user_id": user["user_id"],  # alias
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),  # alias
    }
    await db.videos.insert_one(video_doc)
    return {"link": share_link, "video_id": code, "code": code}

# GET /api/video/{video_id} — Original endpoint (kept for compatibility)
@api_router.get("/video/{video_id}")
async def get_video(video_id: str):
    """Public — get video info by video_id or code"""
    video = await db.videos.find_one({"$or": [{"video_id": video_id}, {"code": video_id}]}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    file_url = video.get("videoUrl") or await get_telegram_file_url(video.get("file_id", ""))
    return {
        "video_id": video.get("code", video.get("video_id", "")),
        "code": video.get("code", video.get("video_id", "")),
        "file_id": video.get("file_id", ""),
        "file_name": video.get("file_name", video.get("title", "")),
        "title": video.get("title", video.get("file_name", "")),
        "description": video.get("description", ""),
        "thumbnail": video.get("thumbnail", ""),
        "videoUrl": file_url,
        "file_url": file_url,
        "views": video.get("views", 0),
        "validViews": video.get("validViews", 0),
        "earnings": video.get("earnings", 0),
        "status": video.get("status", "approved"),
        "shareLink": video.get("shareLink", f"{BASE_URL}/watch/{video.get('code', video.get('video_id', ''))}"),
    }

# GET /api/watch/{code} — Player App fetches video data
@api_router.get("/watch/{code}")
async def watch_video(code: str):
    """Public — Player app fetches video data by code"""
    video = await db.videos.find_one({"$or": [{"code": code}, {"video_id": code}]}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    file_url = video.get("videoUrl") or await get_telegram_file_url(video.get("file_id", ""))
    # Get allow_download setting
    settings = await db.settings.find_one({"key": "allow_download"}, {"_id": 0})
    allow_download = settings.get("value", True) if settings else True
    return {
        "code": video.get("code", video.get("video_id", "")),
        "video_id": video.get("code", video.get("video_id", "")),
        "title": video.get("title", video.get("file_name", "")),
        "description": video.get("description", ""),
        "thumbnail": video.get("thumbnail", ""),
        "videoUrl": file_url,
        "file_url": file_url,
        "file_id": video.get("file_id", ""),
        "file_name": video.get("file_name", ""),
        "views": video.get("views", 0),
        "validViews": video.get("validViews", 0),
        "status": video.get("status", "approved"),
        "ownerId": video.get("ownerId", video.get("user_id", "")),
        "shareLink": video.get("shareLink", f"{BASE_URL}/watch/{code}"),
        "createdAt": video.get("createdAt", video.get("created_at", "")),
        "allowDownload": allow_download,
    }

# GET /api/public/related/{code} — Player App fetches related videos
@api_router.get("/public/related/{code}")
async def get_related_videos(code: str):
    """Public — Related approved videos for player app"""
    related = await db.videos.find(
        {"$or": [{"code": {"$ne": code}}, {"video_id": {"$ne": code}}], "status": "approved"},
        {"_id": 0, "code": 1, "video_id": 1, "title": 1, "file_name": 1,
         "thumbnail": 1, "views": 1, "shareLink": 1, "createdAt": 1, "created_at": 1}
    ).sort("views", -1).limit(10).to_list(10)
    # Normalize fields
    result = []
    for v in related:
        result.append({
            "code": v.get("code", v.get("video_id", "")),
            "title": v.get("title", v.get("file_name", "")),
            "thumbnail": v.get("thumbnail", ""),
            "views": v.get("views", 0),
            "shareLink": v.get("shareLink", ""),
            "createdAt": v.get("createdAt", v.get("created_at", "")),
        })
    return result

# POST /api/view — Count view after 20s watch (with anti-fraud)
@api_router.post("/view")
async def record_view(input_data: ViewInput, request: Request):
    """Public — Android/web calls after 20s watch"""
    vid = input_data.video_id
    video = await db.videos.find_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if input_data.watch_duration < 20:
        return {"counted": False, "message": "Minimum 20 seconds watch required", "watched": input_data.watch_duration}

    # Anti-fraud: IP + UA cooldown
    fingerprint = get_viewer_fingerprint(request)
    vcode = video.get("code", video.get("video_id", ""))
    cooldown_key = f"{fingerprint}:{vcode}"
    recent = await db.view_logs.find_one({"key": cooldown_key, "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(seconds=VIEW_COOLDOWN_SECONDS)}}, {"_id": 0})
    if recent:
        return {"counted": False, "message": "View already counted recently", "cooldown": VIEW_COOLDOWN_SECONDS}

    # Log this view
    await db.view_logs.insert_one({"key": cooldown_key, "timestamp": datetime.now(timezone.utc)})

    # Calculate earning
    cpm = await get_global_cpm()
    earning = cpm / 1000
    owner_id = video.get("ownerId", video.get("user_id", ""))

    await db.videos.update_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"$inc": {"views": 1, "validViews": 1, "earnings": earning}})
    await db.users.update_one({"user_id": owner_id}, {"$inc": {"balance": earning}})
    now = datetime.now(timezone.utc)
    await db.daily_analytics.update_one({"user_id": owner_id, "year": now.year, "month": now.month, "day": now.day}, {"$inc": {"views": 1, "earnings": earning}}, upsert=True)
    await db.monthly_analytics.update_one({"user_id": owner_id, "year": now.year, "month": now.month}, {"$inc": {"views": 1, "earnings": earning}}, upsert=True)

    updated = await db.videos.find_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"_id": 0})
    return {"counted": True, "views": updated.get("views", 0), "validViews": updated.get("validViews", 0), "earnings": round(updated.get("earnings", 0), 4), "earned_this_view": earning}

# POST /api/update-views — Player app calls at 80% watch (with anti-fraud)
@api_router.post("/update-views")
async def update_views(input_data: UpdateViewsInput, request: Request):
    """Public — Player app calls when 80% watched"""
    vid = input_data.video_id
    video = await db.videos.find_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if input_data.watch_percentage < 80:
        return {"counted": False, "message": "Minimum 80% watch required", "watch_percentage": input_data.watch_percentage}

    # Anti-fraud
    fingerprint = get_viewer_fingerprint(request)
    vcode = video.get("code", video.get("video_id", ""))
    cooldown_key = f"{fingerprint}:{vcode}:pct"
    recent = await db.view_logs.find_one({"key": cooldown_key, "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(seconds=VIEW_COOLDOWN_SECONDS)}}, {"_id": 0})
    if recent:
        return {"counted": False, "message": "View already counted recently", "cooldown": VIEW_COOLDOWN_SECONDS}
    await db.view_logs.insert_one({"key": cooldown_key, "timestamp": datetime.now(timezone.utc)})

    cpm = await get_global_cpm()
    earning = cpm / 1000
    owner_id = video.get("ownerId", video.get("user_id", ""))

    await db.videos.update_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"$inc": {"views": 1, "validViews": 1, "earnings": earning}})
    await db.users.update_one({"user_id": owner_id}, {"$inc": {"balance": earning}})
    now = datetime.now(timezone.utc)
    await db.daily_analytics.update_one({"user_id": owner_id, "year": now.year, "month": now.month, "day": now.day}, {"$inc": {"views": 1, "earnings": earning}}, upsert=True)
    await db.monthly_analytics.update_one({"user_id": owner_id, "year": now.year, "month": now.month}, {"$inc": {"views": 1, "earnings": earning}}, upsert=True)

    updated = await db.videos.find_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"_id": 0})
    return {"counted": True, "views": updated.get("views", 0), "validViews": updated.get("validViews", 0), "earnings": round(updated.get("earnings", 0), 4), "earned_this_view": earning}

# GET /api/videos — Dashboard: list user's videos
@api_router.get("/videos")
async def get_videos(request: Request, search: str = ""):
    user = await get_current_user(request)
    query = {"$or": [{"user_id": user["user_id"]}, {"ownerId": user["user_id"]}]}
    if search:
        query["$and"] = [query.pop("$or") and {"$or": [{"user_id": user["user_id"]}, {"ownerId": user["user_id"]}]}, {"$or": [{"title": {"$regex": search, "$options": "i"}}, {"file_name": {"$regex": search, "$options": "i"}}]}]
    videos = await db.videos.find({"$or": [{"user_id": user["user_id"]}, {"ownerId": user["user_id"]}]}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    if search:
        s = search.lower()
        videos = [v for v in videos if s in v.get("title", "").lower() or s in v.get("file_name", "").lower()]
    return videos

@api_router.delete("/videos/{video_id}")
async def delete_video(video_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.videos.delete_one({"$or": [{"video_id": video_id}, {"code": video_id}], "$or": [{"user_id": user["user_id"]}, {"ownerId": user["user_id"]}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"message": "Video deleted"}

# ═══════════════════════════════════════
#  STATS / ANALYTICS
# ═══════════════════════════════════════

@api_router.get("/stats")
async def get_stats(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    links = await db.links.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    videos = await db.videos.find({"$or": [{"user_id": uid}, {"ownerId": uid}]}, {"_id": 0}).to_list(1000)
    lv = sum(l.get("views", 0) for l in links)
    le = sum(l.get("earnings", 0) for l in links)
    vv = sum(v.get("views", 0) for v in videos)
    ve = sum(v.get("earnings", 0) for v in videos)
    total_views = lv + vv
    total_earnings = le + ve
    return {
        "total_views": total_views, "total_earnings": round(total_earnings, 2),
        "referral_earnings": round(total_earnings * 0.15, 2),
        "avg_cpm": round((total_earnings / total_views * 1000) if total_views > 0 else 0, 2),
        "video_views": vv, "video_earnings": round(ve, 2),
    }

@api_router.get("/stats/monthly")
async def get_monthly_stats(request: Request, month: int = 1, year: int = 2025):
    user = await get_current_user(request)
    return await db.daily_analytics.find({"user_id": user["user_id"], "month": month, "year": year}, {"_id": 0}).sort("day", 1).to_list(31)

@api_router.get("/stats/daily")
async def get_daily_stats(request: Request, day: int = 1, month: int = 1, year: int = 2025):
    user = await get_current_user(request)
    record = await db.daily_analytics.find_one({"user_id": user["user_id"], "day": day, "month": month, "year": year}, {"_id": 0})
    return record or {"day": day, "month": month, "year": year, "views": 0, "earnings": 0.0}

@api_router.get("/stats/yearly")
async def get_yearly_stats(request: Request, year: int = 2025):
    user = await get_current_user(request)
    return await db.monthly_analytics.find({"user_id": user["user_id"], "year": year}, {"_id": 0}).sort("month", 1).to_list(12)

# ═══════════════════════════════════════
#  BILLING
# ═══════════════════════════════════════

@api_router.get("/billing/balance")
async def get_balance(request: Request):
    user = await get_current_user(request)
    full = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "balance": 1})
    return {"balance": full.get("balance", 0.0) if full else 0.0}

@api_router.post("/billing/withdraw")
async def withdraw(req: WithdrawRequest, request: Request):
    user = await get_current_user(request)
    full = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    balance = full.get("balance", 0.0) if full else 0.0
    if req.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $10")
    if req.amount > balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()), "user_id": user["user_id"],
        "method": req.method, "amount": req.amount, "details": req.details,
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.withdrawals.insert_one(withdrawal)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"balance": -req.amount}})
    withdrawal.pop("_id", None)
    return withdrawal

@api_router.get("/billing/withdrawals")
async def get_withdrawals(request: Request):
    user = await get_current_user(request)
    return await db.withdrawals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

# ═══════════════════════════════════════
#  BOT / API KEY
# ═══════════════════════════════════════

@api_router.get("/bot/api-key")
async def get_api_key(request: Request):
    user = await get_current_user(request)
    full = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "api_key": 1})
    return {"api_key": full.get("api_key", "") if full else ""}

@api_router.post("/bot/regenerate-key")
async def regenerate_api_key(request: Request):
    user = await get_current_user(request)
    new_key = generate_api_key()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"api_key": new_key}})
    return {"api_key": new_key}

# ═══════════════════════════════════════
#  ADMIN PANEL
# ═══════════════════════════════════════

async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Admin: Get all videos
@api_router.get("/admin/videos")
async def admin_get_videos(request: Request, status: str = ""):
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status
    videos = await db.videos.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return videos

# Admin: Approve/Reject/Delete video
@api_router.post("/admin/video-action")
async def admin_video_action(input_data: AdminVideoAction, request: Request):
    await require_admin(request)
    vid = input_data.video_id
    if input_data.action == "delete":
        await db.videos.delete_one({"$or": [{"video_id": vid}, {"code": vid}]})
        return {"message": "Video deleted"}
    elif input_data.action in ("approve", "reject"):
        await db.videos.update_one({"$or": [{"video_id": vid}, {"code": vid}]}, {"$set": {"status": "approved" if input_data.action == "approve" else "rejected"}})
        return {"message": f"Video {input_data.action}d"}
    raise HTTPException(status_code=400, detail="Invalid action")

# Admin: Set global CPM
@api_router.post("/admin/set-cpm")
async def admin_set_cpm(input_data: AdminCPMUpdate, request: Request):
    await require_admin(request)
    await db.settings.update_one({"key": "global_cpm"}, {"$set": {"key": "global_cpm", "value": input_data.cpm}}, upsert=True)
    return {"message": f"CPM set to ${input_data.cpm}", "cpm": input_data.cpm}

# Admin: Get current CPM
@api_router.get("/admin/get-cpm")
async def admin_get_cpm(request: Request):
    await require_admin(request)
    cpm = await get_global_cpm()
    return {"cpm": cpm}

# Admin: Toggle allow download
@api_router.post("/admin/settings")
async def admin_update_settings(input_data: AdminSettingsUpdate, request: Request):
    await require_admin(request)
    if input_data.allow_download is not None:
        await db.settings.update_one({"key": "allow_download"}, {"$set": {"key": "allow_download", "value": input_data.allow_download}}, upsert=True)
    return {"message": "Settings updated"}

@api_router.get("/admin/settings")
async def admin_get_settings(request: Request):
    await require_admin(request)
    cpm = await get_global_cpm()
    dl = await db.settings.find_one({"key": "allow_download"}, {"_id": 0})
    return {"cpm": cpm, "allow_download": dl.get("value", True) if dl else True}

# Admin: Update user subscription
@api_router.post("/admin/subscription")
async def admin_update_subscription(input_data: AdminSubscriptionUpdate, request: Request):
    await require_admin(request)
    if input_data.subscription not in ("free", "basic", "premium"):
        raise HTTPException(status_code=400, detail="Invalid subscription type")
    result = await db.users.update_one({"user_id": input_data.user_id}, {"$set": {"subscription": input_data.subscription}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Subscription set to {input_data.subscription}"}

# Admin: List all users
@api_router.get("/admin/users")
async def admin_get_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return users

# ═══════════════════════════════════════
#  TELEGRAM BOT WEBHOOK
# ═══════════════════════════════════════

async def telegram_send(chat_id: int, text: str, parse_mode: str = "HTML"):
    async with httpx.AsyncClient() as http:
        await http.post(f"{TELEGRAM_API}/sendMessage", json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode})

@api_router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    body = await request.json()
    message = body.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    if not chat_id:
        return {"ok": True}

    if text.startswith("/start"):
        await telegram_send(chat_id, "<b>Welcome to Merawala Bot!</b>\n\nJust send any <b>video or file</b> and I'll give you an earning link!\n\nShare the link → People watch → You earn money!")
        return {"ok": True}

    if text.startswith("/api "):
        api_key = text[5:].strip()
        user = await db.users.find_one({"api_key": api_key}, {"_id": 0})
        if not user:
            await telegram_send(chat_id, "Key not matched. Just send a video directly — link will be generated automatically!")
            return {"ok": True}
        await db.telegram_users.update_one({"chat_id": chat_id}, {"$set": {"chat_id": chat_id, "api_key": api_key, "user_id": user["user_id"], "linked_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        await telegram_send(chat_id, f"API key linked! Now send any video to get an earning link.")
        return {"ok": True}

    if text.startswith("/help"):
        await telegram_send(chat_id, "<b>Commands:</b>\n/start - Welcome\n/api KEY - Link API key\n/help - Help\n\nJust send a video!")
        return {"ok": True}

    # Handle file upload
    file_id = None
    file_name = "video"
    if message.get("video"):
        file_id = message["video"]["file_id"]
        file_name = message["video"].get("file_name", f"video_{message['video'].get('file_unique_id', 'x')}.mp4")
    elif message.get("document"):
        file_id = message["document"]["file_id"]
        file_name = message["document"].get("file_name", "file")
    elif message.get("animation"):
        file_id = message["animation"]["file_id"]
        file_name = message["animation"].get("file_name", "animation.gif")

    if file_id:
        # Auto-create user if not linked
        tg_user = await db.telegram_users.find_one({"chat_id": chat_id}, {"_id": 0})
        if not tg_user:
            tg_name = message.get("from", {}).get("first_name", "Bot User")
            user_id = f"tg_{chat_id}"
            existing = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if not existing:
                await db.users.insert_one({
                    "user_id": user_id, "email": f"tg_{chat_id}@telegram.bot", "name": tg_name,
                    "role": "user", "subscription": "free", "balance": 0.0,
                    "api_key": generate_api_key(), "telegram_chat_id": chat_id,
                    "created_at": datetime.now(timezone.utc),
                })
            await db.telegram_users.update_one({"chat_id": chat_id}, {"$set": {"chat_id": chat_id, "user_id": user_id, "linked_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
            tg_user = await db.telegram_users.find_one({"chat_id": chat_id}, {"_id": 0})

        # Generate video entry
        code = generate_code(10)
        video_url = await get_telegram_file_url(file_id)
        share_link = f"{BASE_URL}/watch/{code}"
        await db.videos.insert_one({
            "code": code, "video_id": code, "shareLink": share_link,
            "title": file_name, "description": "", "thumbnail": "",
            "videoUrl": video_url or "", "file_id": file_id, "file_name": file_name,
            "views": 0, "validViews": 0, "earnings": 0.0,
            "status": "approved", "ownerId": tg_user["user_id"], "user_id": tg_user["user_id"],
            "createdAt": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await telegram_send(chat_id, f"<b>Link Generated!</b>\n\nFile: {file_name}\nLink: {share_link}\n\nShare this link to earn!\n$1 CPM (first 1K) → $2 CPM (after 1K)")
        return {"ok": True}

    if text and not text.startswith("/"):
        await telegram_send(chat_id, "Send a video or file to get an earning link!\n/help for commands")
    return {"ok": True}

# ═══════════════════════════════════════
#  ROOT
# ═══════════════════════════════════════

@api_router.get("/")
async def root():
    return {"message": "Merawala API", "version": "2.0", "status": "synced"}

# Include router + CORS
app.include_router(api_router)
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000", "https://monetavideo.preview.emergentagent.com", "https://merawala.xyz", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════
#  SEED DATA
# ═══════════════════════════════════════

async def seed_admin_and_demo(database):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_user_id = "user_admin000001"

    existing = await database.users.find_one({"email": admin_email})
    if existing is None:
        await database.users.insert_one({
            "user_id": admin_user_id, "email": admin_email, "name": "Admin",
            "password_hash": hash_password(admin_password), "role": "admin",
            "subscription": "premium", "balance": 247.85, "api_key": generate_api_key(),
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Admin user seeded")
    else:
        admin_user_id = existing.get("user_id", admin_user_id)
        if existing.get("password_hash") and not verify_password(admin_password, existing["password_hash"]):
            await database.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        if "subscription" not in existing:
            await database.users.update_one({"email": admin_email}, {"$set": {"subscription": "premium"}})

    # Seed test video if none exist
    vc = await database.videos.count_documents({})
    if vc == 0:
        test_code = generate_code(10)
        await database.videos.insert_one({
            "code": test_code, "video_id": test_code, "shareLink": f"{BASE_URL}/watch/{test_code}",
            "title": "Sample Video", "description": "This is a sample video for testing",
            "thumbnail": "", "videoUrl": "", "file_id": "", "file_name": "sample_video.mp4",
            "views": 150, "validViews": 142, "earnings": 0.284,
            "status": "approved", "ownerId": admin_user_id, "user_id": admin_user_id,
            "createdAt": datetime.now(timezone.utc).isoformat(), "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Test video seeded: {test_code}")

    # Seed default settings
    cpm_exists = await database.settings.find_one({"key": "global_cpm"})
    if not cpm_exists:
        await database.settings.insert_one({"key": "global_cpm", "value": DEFAULT_CPM})
    dl_exists = await database.settings.find_one({"key": "allow_download"})
    if not dl_exists:
        await database.settings.insert_one({"key": "allow_download", "value": True})

    # Write test credentials
    cred_dir = Path("/app/memory")
    cred_dir.mkdir(exist_ok=True)
    with open(cred_dir / "test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n")

    # Safe index creation
    for idx in [
        (database.users, "email", True), (database.users, "api_key", False),
        (database.videos, "code", False), (database.videos, "video_id", False),
        (database.videos, "ownerId", False), (database.telegram_users, "chat_id", True),
        (database.login_attempts, "identifier", False), (database.view_logs, "key", False),
    ]:
        try:
            await idx[0].create_index(idx[1], unique=idx[2])
        except Exception:
            pass
    # TTL on view_logs (auto-delete after 1 hour)
    try:
        await database.view_logs.create_index("timestamp", expireAfterSeconds=3600)
    except Exception:
        pass

@app.on_event("startup")
async def startup():
    await seed_admin_and_demo(db)
    # NOTE: Telegram webhook is managed by monetavideo (player app) project
    # since merawala.xyz domain points there. Do NOT set webhook here
    # to avoid overwriting monetavideo's webhook.

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
