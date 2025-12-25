from sqlalchemy import Boolean, Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class VisitType(str, enum.Enum):
    PHYSICAL = "physical"
    VIRTUAL = "virtual"


class VisitStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PROPOSED_RESCHEDULE = "proposed_reschedule"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW_BUYER = "no_show_buyer"
    NO_SHOW_AGENT = "no_show_agent"
    DECLINED = "declined"


class UserProperty(Base):
    __tablename__ = "properties"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)
    # house, apartment, condo, land, etc.
    property_type = Column(String, nullable=False)
    # sale, rent
    listing_type = Column(String, nullable=False)  
    price = Column(Float, nullable=False)
    bedrooms = Column(Integer)
    bathrooms = Column(Integer)
    area_sqft = Column(Float)
    address = Column(String, nullable=False)
    city = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False)
    zip_code = Column(String)
    country = Column(String, default="USA")
    year_built = Column(Integer)
    parking_spaces = Column(Integer)
    amenities = Column(Text)  # JSON string of amenities
    is_available = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=False)  # Needs admin approval
    approval_status = Column(String, default=ApprovalStatus.PENDING.value)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("User", back_populates="properties")
    images = relationship("PropertyImage", back_populates="property", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="property", cascade="all, delete-orphan")
    visit_requests = relationship("VisitRequest", back_populates="property", cascade="all, delete-orphan")


class PropertyImage(Base):
    __tablename__ = "property_images"
    
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    image_url = Column(String, nullable=False)  # Cloudinary URL
    public_id = Column(String)  # Cloudinary public_id for deletion
    is_primary = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    property = relationship("UserProperty", back_populates="images")


class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="favorites")
    property = relationship("UserProperty", back_populates="favorites")


class VisitRequest(Base):
    __tablename__ = "visit_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Request details
    visit_type = Column(String, nullable=False)  # physical or virtual
    status = Column(String, default=VisitStatus.PENDING.value, index=True)
    
    # Buyer's preferred date/time
    preferred_date = Column(DateTime, nullable=False)
    preferred_time_start = Column(String, nullable=False)
    preferred_time_end = Column(String, nullable=False)
    buyer_note = Column(Text)
    
    # Agent's proposed date/time 
    proposed_date = Column(DateTime)
    proposed_time_start = Column(String)
    proposed_time_end = Column(String)
    agent_note = Column(Text)
    
    # Confirmed date/time
    confirmed_date = Column(DateTime)
    confirmed_time_start = Column(String)
    confirmed_time_end = Column(String)
    
    # Decline reason
    decline_reason = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    property = relationship("UserProperty", back_populates="visit_requests")
    buyer = relationship("User", foreign_keys=[buyer_id], backref="buyer_visits")
    agent = relationship("User", foreign_keys=[agent_id], backref="agent_visits")