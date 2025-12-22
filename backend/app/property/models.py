from sqlalchemy import Boolean, Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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