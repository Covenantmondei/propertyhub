from app.database import Base
from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum


class UserRole(str, enum.Enum):
    BUYER = "buyer"
    AGENT = "agent"
    ADMIN = "admin"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KYCStatus(str, enum.Enum):
    UNVERIFIED = "unverified"
    PENDING_REVIEW = "pending_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    is_verified = Column(Boolean, default=False)
    role = Column(String, default=UserRole.BUYER.value)
    is_approved = Column(Boolean, default=True)
    approval_status = Column(String, default=ApprovalStatus.APPROVED.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Anti-abuse tracking
    no_show_count = Column(Integer, default=0)
    declined_visits_count = Column(Integer, default=0)
    completed_visits_count = Column(Integer, default=0)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text)
    last_flag_date = Column(DateTime)
    
    # KYC Status (for agents)
    kyc_status = Column(String, default=KYCStatus.UNVERIFIED.value)
    kyc_submitted_at = Column(DateTime)
    kyc_verified_at = Column(DateTime)
    kyc_rejection_reason = Column(Text)
    
    # Relationships
    agent_profile = relationship("AgentProfile", back_populates="user", uselist=False)
    properties = relationship("UserProperty", back_populates="agent")
    favorites = relationship("Favorite", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user", foreign_keys="ActivityLog.user_id")
    admin_actions = relationship("ActivityLog", back_populates="admin", foreign_keys="ActivityLog.admin_id")


class AgentProfile(Base):
    __tablename__ = "agent_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone_number = Column(String)
    bio = Column(Text)
    profile_picture = Column(String)  # Cloudinary URL
    company = Column(String)
    years_experience = Column(Integer)
    
    # KYC Documents
    government_id_url = Column(String)  # Cloudinary URL
    government_id_public_id = Column(String)
    selfie_url = Column(String)
    selfie_public_id = Column(String)
    id_type = Column(String)
    id_number = Column(String)
    
    # Agent rating/ranking
    rating = Column(Float, default=5.0)
    total_ratings = Column(Integer, default=0)
    ranking_score = Column(Float, default=100.0)  # Starts at 100, decreases with bad behavior
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="agent_profile")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String)
    entity_id = Column(Integer)
    details = Column(Text)
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="activity_logs", foreign_keys=[user_id])
    admin = relationship("User", back_populates="admin_actions", foreign_keys=[admin_id])



class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    blacklisted_on = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)