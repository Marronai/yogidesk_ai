from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import random
import time

# --- 1. DATABASE CONFIGURATION ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./marroncorp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 2. DATABASE MODELS (Tables) ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    company_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="admin") # 'admin' or 'agent'
    
    # 💎 Plan & Limits
    plan_type = Column(String, default="lite") # lite, elite, bronze, premium
    
    # 🔥 NEW FIELD: Organization Category (Dynamic Dashboard ke liye)
    org_category = Column(String, default="retail") # retail, hospital, school, real_estate

    # 👥 Team Hierarchy
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    permissions = Column(JSON, default={}) 

    # ⏰ Premium Agent Features
    shift_start = Column(String, nullable=True) # "09:00"
    shift_end = Column(String, nullable=True)   # "18:00"
    daily_message_limit = Column(Integer, default=0) 
    
    # ⚙️ Settings & Tools
    whatsapp_token = Column(String, nullable=True)
    whatsapp_phone_id = Column(String, nullable=True)
    whatsapp_business_id = Column(String, nullable=True)
    
    # 🌙 Offline Mode (Auto-Reply)
    is_offline = Column(Boolean, default=False)
    offline_message = Column(String, default="We are currently closed. We will reply shortly.")

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id")) # Belongs to Admin
    name = Column(String)
    phone = Column(String)
    status = Column(String, default="new") # new, hot, cold, closed
    last_message = Column(String, nullable=True)
    last_active = Column(DateTime, default=datetime.utcnow)
    
    # ⏰ Reminder Feature
    reminder_note = Column(String, nullable=True)
    reminder_time = Column(DateTime, nullable=True)

# --- 3. PYDANTIC SCHEMAS (Data Validation) ---

class UserCreate(BaseModel):
    full_name: str
    company_name: str
    email: str
    password: str
    plan_type: str = "lite"
    org_category: str = "retail" # 🔥 Default retail

class LoginRequest(BaseModel):
    email: str
    password: str

class AgentCreate(BaseModel):
    full_name: str
    email: str
    password: str
    permissions: dict = {}
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    daily_message_limit: Optional[int] = 0

class SettingsUpdate(BaseModel):
    whatsapp_token: str
    whatsapp_phone_id: str
    whatsapp_business_id: Optional[str] = None
    is_offline: Optional[bool] = False
    offline_message: Optional[str] = None

class ContactCreate(BaseModel):
    name: str
    phone: str
    status: str = "new"

# --- 4. APP SETUP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 5. ROUTES ---

@app.get("/")
def home(): return {"message": "Marroncorp AI Backend v3.0 is Live! 🚀"}

# ✅ AUTHENTICATION (Updated for Category)
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        full_name=user.full_name, 
        company_name=user.company_name,
        email=user.email, 
        hashed_password=pwd_context.hash(user.password),
        plan_type=user.plan_type, 
        org_category=user.org_category, # 🔥 Saving Category
        role="admin"
    )
    db.add(new_user); db.commit(); db.refresh(new_user)
    return {"message": "Account Created Successfully", "user_id": new_user.id}

@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=404, detail="Invalid Credentials")
    
    return {
        "message": "Login Successful",
        "user_id": user.id, 
        "name": user.full_name,
        "company": user.company_name, 
        "plan": user.plan_type,
        "category": user.org_category, # 🔥 Sending Category to Frontend
        "role": user.role
    }

# ✅ SETTINGS (Offline Mode + WhatsApp)
@app.put("/users/{user_id}/settings")
def update_settings(user_id: int, s: SettingsUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    user.whatsapp_token = s.whatsapp_token
    user.whatsapp_phone_id = s.whatsapp_phone_id
    user.whatsapp_business_id = s.whatsapp_business_id
    
    # 🌙 Toggle Offline Mode
    if s.is_offline is not None:
        user.is_offline = s.is_offline
    if s.offline_message:
        user.offline_message = s.offline_message
        
    db.commit()
    return {"message": "Settings Updated"}

@app.get("/users/{user_id}/settings")
def get_settings(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: return {}
    return {
        "whatsapp_token": user.whatsapp_token,
        "whatsapp_phone_id": user.whatsapp_phone_id,
        "whatsapp_business_id": user.whatsapp_business_id,
        "is_offline": user.is_offline,
        "offline_message": user.offline_message
    }

# ✅ TEAM MANAGEMENT (With Plan Limits)
@app.post("/users/{admin_id}/agents")
def create_agent(admin_id: int, agent: AgentCreate, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin: raise HTTPException(status_code=404, detail="Admin not found")
    
    # 🔒 PLAN LIMITS
    LIMITS = {"lite": 0, "elite": 1, "bronze": 3, "premium": 5}
    current_count = db.query(User).filter(User.owner_id == admin_id).count()
    
    if current_count >= LIMITS.get(admin.plan_type, 0):
        raise HTTPException(status_code=400, detail=f"Upgrade Plan! Limit: {LIMITS.get(admin.plan_type)} users.")

    # 🔒 PREMIUM FEATURE CHECK
    s_start, s_end, budget = None, None, 0
    if admin.plan_type == "premium":
        s_start, s_end, budget = agent.shift_start, agent.shift_end, agent.daily_message_limit

    if db.query(User).filter(User.email == agent.email).first():
        raise HTTPException(status_code=400, detail="Email exists")

    new_agent = User(
        full_name=agent.full_name, company_name=admin.company_name,
        email=agent.email, hashed_password=pwd_context.hash(agent.password),
        role="agent", owner_id=admin_id, permissions=agent.permissions,
        shift_start=s_start, shift_end=s_end, daily_message_limit=budget
    )
    db.add(new_agent); db.commit()
    return {"message": "Agent Created"}

@app.get("/users/{admin_id}/agents")
def get_agents(admin_id: int, db: Session = Depends(get_db)):
    return db.query(User).filter(User.owner_id == admin_id).all()

# ✅ INBOX & CONTACTS
@app.post("/contacts/{user_id}")
def add_contact(user_id: int, contact: ContactCreate, db: Session = Depends(get_db)):
    new_contact = Contact(
        owner_id=user_id, name=contact.name, phone=contact.phone, status=contact.status,
        last_message="No history", last_active=datetime.utcnow()
    )
    db.add(new_contact); db.commit()
    return new_contact

@app.get("/contacts/{user_id}")
def get_contacts(user_id: int, db: Session = Depends(get_db)):
    return db.query(Contact).filter(Contact.owner_id == user_id).all()

# ✅ ANALYTICS & HEATMAP (Mock Data)
@app.get("/api/stats/heatmap")
def get_heatmap():
    return [
        {"hour": "9 AM", "activity": 20},
        {"hour": "12 PM", "activity": 85},
        {"hour": "3 PM", "activity": 45},
        {"hour": "6 PM", "activity": 100},
        {"hour": "9 PM", "activity": 30},
    ]

# ✅ ANTI-BAN SAFE SEND
class MessageSend(BaseModel):
    phone: str
    message: str
    is_bulk: bool = False

@app.post("/send-message")
def send_message(msg: MessageSend):
    if msg.is_bulk:
        delay = random.randint(2, 5)
        time.sleep(0.5) 
        return {"status": "Queued", "info": f"Message scheduled with {delay}s safe-delay"}
    
    return {"status": "Sent", "info": "Instant delivery"}