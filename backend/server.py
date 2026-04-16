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
import httpx
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from bson import ObjectId

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

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

def generate_short_code(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def generate_api_key():
    return f"ms_{secrets.token_hex(24)}"

async def get_current_user(request: Request) -> dict:
    # Check session_token cookie first (Google Auth)
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

    # Check JWT access_token cookie
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Could be a session token passed as Bearer
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
    method: str  # upi, bank, paypal, crypto
    amount: float
    details: dict  # method-specific details

class GenerateLinkInput(BaseModel):
    api_key: str
    file_id: str
    file_name: str = "Untitled Video"

class ViewInput(BaseModel):
    video_id: str
    watch_duration: int = 0  # seconds watched

EARNING_PER_VIEW_FIRST = 0.001   # $1 per 1000 views (first 1000)
EARNING_PER_VIEW_AFTER = 0.002   # $2 per 1000 views (after 1000)
MIN_WATCH_SECONDS = 20           # minimum 20 seconds to count as view

# ─── Auth Routes ───
@api_router.post("/auth/register")
async def register(input_data: RegisterInput, response: Response):
    email = input_data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": input_data.name,
        "password_hash": hash_password(input_data.password),
        "role": "user",
        "balance": 0.0,
        "api_key": generate_api_key(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)

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
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(input_data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear attempts on success
    await db.login_attempts.delete_many({"identifier": identifier})
    user_id = user.get("user_id", str(user["_id"]))

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
    user = await get_current_user(request)
    return user

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

# ─── Google OAuth Session Exchange ───
@api_router.post("/auth/google/session")
async def google_session_exchange(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token", "")

    # Find or create user
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing.get("user_id", str(existing["_id"]))
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "user",
            "balance": 0.0,
            "api_key": generate_api_key(),
            "created_at": datetime.now(timezone.utc),
        })

    # Store session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    # Also set JWT access_token so /auth/me works via both methods
    access_token = create_access_token(user_id, email)
    refresh_token_val = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token_val, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user.pop("password_hash", None)
    return user

# ─── Links CRUD ───
@api_router.post("/links")
async def create_link(link: LinkCreate, request: Request):
    user = await get_current_user(request)
    short_code = generate_short_code()
    link_doc = {
        "link_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "title": link.title,
        "original_url": link.original_url,
        "short_code": short_code,
        "views": 0,
        "earnings": 0.0,
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
    links = await db.links.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return links

@api_router.put("/links/{link_id}")
async def update_link(link_id: str, link: LinkUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in link.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.links.update_one({"link_id": link_id, "user_id": user["user_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    updated = await db.links.find_one({"link_id": link_id}, {"_id": 0})
    return updated

@api_router.delete("/links/{link_id}")
async def delete_link(link_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.links.delete_one({"link_id": link_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"message": "Link deleted"}

# ─── Stats / Analytics ───
@api_router.get("/stats")
async def get_stats(request: Request):
    user = await get_current_user(request)
    links = await db.links.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    videos = await db.videos.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    link_views = sum(l.get("views", 0) for l in links)
    link_earnings = sum(l.get("earnings", 0) for l in links)
    video_views = sum(v.get("views", 0) for v in videos)
    video_earnings = sum(v.get("earnings", 0) for v in videos)
    total_views = link_views + video_views
    total_earnings = link_earnings + video_earnings
    referral_earnings = total_earnings * 0.15
    avg_cpm = (total_earnings / total_views * 1000) if total_views > 0 else 0.0
    return {
        "total_views": total_views,
        "total_earnings": round(total_earnings, 2),
        "referral_earnings": round(referral_earnings, 2),
        "avg_cpm": round(avg_cpm, 2),
        "video_views": video_views,
        "video_earnings": round(video_earnings, 2),
        "link_views": link_views,
        "link_earnings": round(link_earnings, 2),
    }

@api_router.get("/stats/monthly")
async def get_monthly_stats(request: Request, month: int = 1, year: int = 2025):
    user = await get_current_user(request)
    # Get daily stats from analytics collection
    daily = await db.daily_analytics.find(
        {"user_id": user["user_id"], "month": month, "year": year},
        {"_id": 0}
    ).sort("day", 1).to_list(31)
    return daily

@api_router.get("/stats/daily")
async def get_daily_stats(request: Request, day: int = 1, month: int = 1, year: int = 2025):
    user = await get_current_user(request)
    record = await db.daily_analytics.find_one(
        {"user_id": user["user_id"], "day": day, "month": month, "year": year},
        {"_id": 0}
    )
    if not record:
        return {"day": day, "month": month, "year": year, "views": 0, "earnings": 0.0}
    return record

@api_router.get("/stats/yearly")
async def get_yearly_stats(request: Request, year: int = 2025):
    user = await get_current_user(request)
    monthly = await db.monthly_analytics.find(
        {"user_id": user["user_id"], "year": year},
        {"_id": 0}
    ).sort("month", 1).to_list(12)
    return monthly

# ─── Billing ───
@api_router.get("/billing/balance")
async def get_balance(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "balance": 1})
    return {"balance": full_user.get("balance", 0.0)}

@api_router.post("/billing/withdraw")
async def withdraw(req: WithdrawRequest, request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    balance = full_user.get("balance", 0.0)
    if req.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $10")
    if req.amount > balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    withdrawal = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "method": req.method,
        "amount": req.amount,
        "details": req.details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.withdrawals.insert_one(withdrawal)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"balance": -req.amount}})
    withdrawal.pop("_id", None)
    return withdrawal

@api_router.get("/billing/withdrawals")
async def get_withdrawals(request: Request):
    user = await get_current_user(request)
    withdrawals = await db.withdrawals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return withdrawals

# ─── Bot / API ───
@api_router.get("/bot/api-key")
async def get_api_key(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "api_key": 1})
    return {"api_key": full_user.get("api_key", "")}

@api_router.post("/bot/regenerate-key")
async def regenerate_api_key(request: Request):
    user = await get_current_user(request)
    new_key = generate_api_key()
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"api_key": new_key}})
    return {"api_key": new_key}

@api_router.post("/bot/upload")
async def bot_upload(request: Request):
    """Placeholder endpoint for Telegram bot file uploads"""
    body = await request.json()
    api_key = body.get("api_key")
    file_url = body.get("file_url")
    title = body.get("title", "Untitled")

    if not api_key or not file_url:
        raise HTTPException(status_code=400, detail="api_key and file_url required")

    user = await db.users.find_one({"api_key": api_key}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")

    short_code = generate_short_code()
    link_doc = {
        "link_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "title": title,
        "original_url": file_url,
        "short_code": short_code,
        "views": 0,
        "earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.links.insert_one(link_doc)
    link_doc.pop("_id", None)
    return {"short_link": f"https://merawala.xyz/{short_code}", "link": link_doc}

# ─── Video / Generate Link System ───

@api_router.post("/generate-link")
async def generate_link(input_data: GenerateLinkInput):
    """Public API - Telegram bot calls this with api_key to generate video link"""
    user = await db.users.find_one({"api_key": input_data.api_key}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")

    video_id = uuid.uuid4().hex[:10]
    video_doc = {
        "video_id": video_id,
        "user_id": user["user_id"],
        "file_id": input_data.file_id,
        "file_name": input_data.file_name,
        "views": 0,
        "earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.videos.insert_one(video_doc)

    base_url = os.environ.get("FRONTEND_URL", "https://merawala.xyz")
    link = f"{base_url}/v/{video_id}"

    return {"link": link, "video_id": video_id}

@api_router.get("/video/{video_id}")
async def get_video(video_id: str):
    """Public API - Android app calls this to get video info"""
    video = await db.videos.find_one({"video_id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return {
        "video_id": video["video_id"],
        "file_id": video["file_id"],
        "file_name": video["file_name"],
        "views": video["views"],
    }

@api_router.post("/view")
async def record_view(input_data: ViewInput):
    """Public API - Android app calls this after 20+ seconds of playback"""
    video = await db.videos.find_one({"video_id": input_data.video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if input_data.watch_duration < MIN_WATCH_SECONDS:
        return {
            "counted": False,
            "message": f"Minimum {MIN_WATCH_SECONDS} seconds watch required",
            "watched": input_data.watch_duration,
        }

    # Increment view and earnings (Tiered CPM)
    # First 1000 views: $1 CPM ($0.001/view)
    # After 1000 views: $2 CPM ($0.002/view)
    current_views = video.get("views", 0)
    earning = EARNING_PER_VIEW_FIRST if current_views < 1000 else EARNING_PER_VIEW_AFTER

    await db.videos.update_one(
        {"video_id": input_data.video_id},
        {"$inc": {"views": 1, "earnings": earning}}
    )

    # Also update user balance
    await db.users.update_one(
        {"user_id": video["user_id"]},
        {"$inc": {"balance": earning}}
    )

    # Update daily analytics
    now = datetime.now(timezone.utc)
    await db.daily_analytics.update_one(
        {"user_id": video["user_id"], "year": now.year, "month": now.month, "day": now.day},
        {"$inc": {"views": 1, "earnings": earning}},
        upsert=True
    )

    # Update monthly analytics
    await db.monthly_analytics.update_one(
        {"user_id": video["user_id"], "year": now.year, "month": now.month},
        {"$inc": {"views": 1, "earnings": earning}},
        upsert=True
    )

    updated = await db.videos.find_one({"video_id": input_data.video_id}, {"_id": 0})
    return {
        "counted": True,
        "views": updated["views"],
        "earnings": round(updated["earnings"], 4),
        "earned_this_view": earning,
    }

@api_router.get("/videos")
async def get_videos(request: Request, search: str = ""):
    """Dashboard API - list user's videos"""
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if search:
        query["file_name"] = {"$regex": search, "$options": "i"}
    videos = await db.videos.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return videos

@api_router.delete("/videos/{video_id}")
async def delete_video(video_id: str, request: Request):
    """Dashboard API - delete a video"""
    user = await get_current_user(request)
    result = await db.videos.delete_one({"video_id": video_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"message": "Video deleted"}

# ─── Root ───
@api_router.get("/")
async def root():
    return {"message": "Merawala API"}

# Include router
app.include_router(api_router)

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Seed Data ───
async def seed_admin_and_demo(database):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_user_id = "user_admin000001"

    existing = await database.users.find_one({"email": admin_email})
    if existing is None:
        await database.users.insert_one({
            "user_id": admin_user_id,
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "balance": 247.85,
            "api_key": generate_api_key(),
            "created_at": datetime.now(timezone.utc),
        })
        logger.info("Admin user seeded")
    else:
        admin_user_id = existing.get("user_id", admin_user_id)
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await database.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed demo links
    existing_links = await database.links.count_documents({"user_id": admin_user_id})
    if existing_links == 0:
        demo_links = [
            {"title": "Premium Course Bundle", "original_url": "https://example.com/course-bundle.zip", "views": 12450, "earnings": 87.15},
            {"title": "Photo Editing Pack", "original_url": "https://example.com/photo-pack.zip", "views": 8930, "earnings": 62.51},
            {"title": "Music Collection 2025", "original_url": "https://example.com/music.zip", "views": 15780, "earnings": 110.46},
            {"title": "Software Toolkit v3", "original_url": "https://example.com/toolkit.zip", "views": 6230, "earnings": 43.61},
            {"title": "Video Templates HD", "original_url": "https://example.com/templates.zip", "views": 19450, "earnings": 136.15},
            {"title": "E-book Library", "original_url": "https://example.com/ebooks.zip", "views": 4320, "earnings": 30.24},
            {"title": "Game Mods Pack", "original_url": "https://example.com/mods.zip", "views": 22100, "earnings": 154.70},
            {"title": "Wallpaper Collection 4K", "original_url": "https://example.com/wallpapers.zip", "views": 3150, "earnings": 22.05},
        ]
        for dl in demo_links:
            await database.links.insert_one({
                "link_id": str(uuid.uuid4()),
                "user_id": admin_user_id,
                "title": dl["title"],
                "original_url": dl["original_url"],
                "short_code": generate_short_code(),
                "views": dl["views"],
                "earnings": dl["earnings"],
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat(),
            })
        logger.info("Demo links seeded")

    # Seed daily analytics
    existing_daily = await database.daily_analytics.count_documents({"user_id": admin_user_id})
    if existing_daily == 0:
        for month in range(1, 13):
            days_in_month = 28 if month == 2 else (30 if month in [4, 6, 9, 11] else 31)
            for day in range(1, days_in_month + 1):
                views = random.randint(200, 3500)
                earnings = round(views * random.uniform(0.005, 0.009), 2)
                await database.daily_analytics.insert_one({
                    "user_id": admin_user_id,
                    "year": 2025,
                    "month": month,
                    "day": day,
                    "views": views,
                    "earnings": earnings,
                })
        logger.info("Daily analytics seeded")

    # Seed monthly analytics
    existing_monthly = await database.monthly_analytics.count_documents({"user_id": admin_user_id})
    if existing_monthly == 0:
        for month in range(1, 13):
            views = random.randint(15000, 85000)
            earnings = round(views * random.uniform(0.006, 0.008), 2)
            await database.monthly_analytics.insert_one({
                "user_id": admin_user_id,
                "year": 2025,
                "month": month,
                "views": views,
                "earnings": earnings,
            })
        logger.info("Monthly analytics seeded")

    # Write test credentials
    cred_dir = Path("/app/memory")
    cred_dir.mkdir(exist_ok=True)
    with open(cred_dir / "test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin Account\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n- POST /api/auth/google/session\n")

    # Create indexes
    await database.users.create_index("email", unique=True)
    await database.users.create_index("user_id", unique=True)
    await database.users.create_index("api_key")
    await database.links.create_index("user_id")
    await database.links.create_index("link_id", unique=True)
    await database.videos.create_index("video_id", unique=True)
    await database.videos.create_index("user_id")
    await database.login_attempts.create_index("identifier")
    await database.daily_analytics.create_index([("user_id", 1), ("year", 1), ("month", 1)])
    await database.monthly_analytics.create_index([("user_id", 1), ("year", 1)])

@app.on_event("startup")
async def startup():
    await seed_admin_and_demo(db)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
