from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    company_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # Role: 'admin' (Boss) or 'agent' (Employee)
    role = Column(String, default="admin")
    
    # Link to the Boss (If this user is an agent, who created them?)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Permissions (JSON format to store multiple rights)
    # Example: {"can_send": true, "can_export": false, "message_limit": 50}
    permissions = Column(JSON, default={})
    
    is_active = Column(Boolean, default=True)
    
    # WhatsApp Config (Only Admin needs this usually, Agents use Admin's config)
    whatsapp_token = Column(String, nullable=True)
    whatsapp_phone_id = Column(String, nullable=True)
    whatsapp_business_id = Column(String, nullable=True)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) 
    recipient_phone = Column(String)
    message_content = Column(String)
    status = Column(String, default="sent") 
    timestamp = Column(String)