from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

# AI Config
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# --- Auth Helper ---
async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Auth Endpoints ---
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")

    user_data = resp.json()

    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": user_data["email"]},
            {"$set": {"name": user_data["name"], "picture": user_data.get("picture", "")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "settings": {"theme": "light"}
        })

    session_token = f"st_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# --- Purchase Endpoints ---
@api_router.post("/purchases")
async def create_purchase(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    item_name = body.get("item_name", "").strip()
    cost = body.get("cost")

    if not item_name or cost is None:
        raise HTTPException(status_code=400, detail="item_name and cost required")

    cost = float(cost)
    if cost <= 0:
        raise HTTPException(status_code=400, detail="Cost must be positive")

    # Generate waiting period with Gemini 3 Flash
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"wp_{uuid.uuid4().hex[:8]}",
            system_message="You determine waiting periods for impulse purchases. Respond with ONLY valid JSON."
        ).with_model("gemini", "gemini-3-flash-preview")

        prompt = f"""Item: {item_name}
Cost: ${cost:.2f}

The user is a young person who earns about $10 per week from chores. Money is tight and every dollar counts. Determine a generous cooling-off waiting period in hours so they really think it through. Guidelines based on how many weeks of income this costs:
- Under $5 (less than half a week): 24-48 hours (1-2 days)
- $5-$10 (about a week's income): 48-96 hours (2-4 days)
- $10-$25 (1-2.5 weeks' income): 96-168 hours (4-7 days)
- $25-$50 (2.5-5 weeks' income): 168-336 hours (7-14 days)
- $50+ (over a month's income): 336-504 hours (14-21 days)
Necessities get slightly shorter periods, but luxuries and wants should be on the longer end.

Respond ONLY with valid JSON: {{"hours": <number>, "reason": "<brief encouraging reason framed for a young saver, 1-2 sentences>"}}"""

        ai_response = await chat.send_message(UserMessage(text=prompt))
        logger.info(f"AI waiting period response: {ai_response}")
        json_match = re.search(r'\{[^}]+\}', ai_response)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = {"hours": 24, "reason": "Let's give it a day to see if you really need this."}
    except Exception as e:
        logger.error(f"AI error generating waiting period: {e}")
        result = {"hours": 24, "reason": "Let's give it a day to see if you really need this."}

    hours = max(1, min(504, float(result.get("hours", 48))))
    reason = str(result.get("reason", "Give yourself time to think it over."))

    now = datetime.now(timezone.utc)
    purchase = {
        "purchase_id": f"p_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "item_name": item_name,
        "cost": cost,
        "waiting_hours": hours,
        "waiting_reason": reason,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=hours)).isoformat(),
        "status": "waiting"
    }

    await db.purchases.insert_one(purchase)
    purchase.pop("_id", None)
    return purchase


@api_router.get("/purchases")
async def list_purchases(request: Request):
    user = await get_current_user(request)
    purchases = await db.purchases.find(
        {"user_id": user["user_id"], "status": "waiting"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return purchases


@api_router.get("/purchases/history")
async def get_history(request: Request):
    user = await get_current_user(request)
    purchases = await db.purchases.find(
        {"user_id": user["user_id"], "status": {"$in": ["bought", "skipped"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return purchases


@api_router.patch("/purchases/{purchase_id}/decide")
async def decide_purchase(purchase_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    decision = body.get("decision")
    if decision not in ["bought", "skipped"]:
        raise HTTPException(status_code=400, detail="decision must be 'bought' or 'skipped'")

    result = await db.purchases.update_one(
        {"purchase_id": purchase_id, "user_id": user["user_id"]},
        {"$set": {"status": decision, "decided_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return {"message": f"Marked as {decision}"}


@api_router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.purchases.delete_one(
        {"purchase_id": purchase_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Purchase not found")
    await db.chat_messages.delete_many({"purchase_id": purchase_id})
    return {"message": "Deleted"}


# --- Chat Endpoints ---
@api_router.post("/chat/{purchase_id}")
async def send_chat(purchase_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message required")

    purchase = await db.purchases.find_one(
        {"purchase_id": purchase_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    prev = await db.chat_messages.find(
        {"purchase_id": purchase_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)

    nl = "\n"
    history = nl.join([f"{'User' if m['role']=='user' else 'Advisor'}: {m['content']}" for m in prev])

    history_section = f"Conversation so far:{nl}{history}" if history else "First message in this conversation."

    system_msg = f"""You are a friendly, encouraging financial advisor for a young person (13 years old) who earns about $10 per week from chores. Money is really tight for them.

Purchase details:
- Item: {purchase['item_name']}
- Cost: ${purchase['cost']:.2f}
- That's about {purchase['cost']/10:.1f} weeks of chore money!
- Waiting period: {purchase['waiting_hours']} hours

{history_section}

Strategies to use:
- Put the cost in "weeks of chores" terms ("That's X weeks of doing dishes and cleaning your room!")
- Suggest saving up for something bigger or better
- Ask if their friends actually care about this stuff
- Mention what else they could do with the money (save for something really cool, a fun outing, etc.)
- Be like a cool older sibling — supportive, real, a bit funny, never preachy
- Keep responses to 2-3 sentences max
- Use casual, age-appropriate language"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"c_{purchase_id}_{uuid.uuid4().hex[:6]}",
            system_message=system_msg
        ).with_model("gemini", "gemini-3-flash-preview")

        ai_response = await chat.send_message(UserMessage(text=message))
    except Exception as e:
        logger.error(f"Chat AI error: {e}")
        ai_response = "I'm having trouble thinking right now, but remember - if you have to think twice about buying it, you probably don't need it!"

    now = datetime.now(timezone.utc).isoformat()

    user_msg = {
        "message_id": f"m_{uuid.uuid4().hex[:12]}",
        "purchase_id": purchase_id,
        "user_id": user["user_id"],
        "role": "user",
        "content": message,
        "created_at": now
    }
    await db.chat_messages.insert_one(user_msg)
    user_msg.pop("_id", None)

    ai_msg = {
        "message_id": f"m_{uuid.uuid4().hex[:12]}",
        "purchase_id": purchase_id,
        "user_id": user["user_id"],
        "role": "assistant",
        "content": ai_response,
        "created_at": now
    }
    await db.chat_messages.insert_one(ai_msg)
    ai_msg.pop("_id", None)

    return {"user_message": user_msg, "ai_message": ai_msg}


@api_router.get("/chat/{purchase_id}")
async def get_chat(purchase_id: str, request: Request):
    user = await get_current_user(request)
    purchase = await db.purchases.find_one(
        {"purchase_id": purchase_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    messages = await db.chat_messages.find(
        {"purchase_id": purchase_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    return {"messages": messages, "purchase": purchase}


# --- Push Token ---
@api_router.post("/push-token")
async def register_token(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="token required")

    await db.push_tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "token": token,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Token registered"}


# --- User Settings ---
@api_router.get("/user/settings")
async def get_user_settings(request: Request):
    user = await get_current_user(request)
    return {"settings": user.get("settings", {"theme": "light"})}


@api_router.put("/user/settings")
async def update_user_settings(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    settings = body.get("settings", {})
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"settings": settings}}
    )
    return {"settings": settings}


# Include router
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
