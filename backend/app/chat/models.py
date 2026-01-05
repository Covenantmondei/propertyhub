from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_message_preview = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    property = relationship("UserProperty")
    buyer = relationship("User", foreign_keys=[buyer_id])
    agent = relationship("User", foreign_keys=[agent_id])
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    # For unique conversqation b/w a buyer and an agent
    __table_args__ = (
        Index('idx_buyer_property', 'buyer_id', 'property_id', unique=True),
        Index('idx_agent_buyer', 'agent_id', 'buyer_id'),
    )


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    # Message status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")

    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_conversation_created', 'conversation_id', 'created_at'),
        Index('idx_sender_conversation', 'sender_id', 'conversation_id'),
    )


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    
    # Optional fields for different notification types
    notification_type = Column(String, default="message")  # message, visit_request, visit_update, etc.
    related_id = Column(Integer, nullable=True)  # ID of related entity (visit_id, property_id, etc.)
    
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
    message = relationship("Message")
    conversation = relationship("Conversation")
    
    __table_args__ = (
        Index('idx_user_read', 'user_id', 'is_read'),
        Index('idx_user_created', 'user_id', 'created_at'),
    )