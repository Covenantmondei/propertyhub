from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageCreate(MessageBase):
    conversation_id: int
    

class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    sender_id: int
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime
    
    sender_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    property_id: int
    message: str = Field(..., min_length=1, max_length=5000)


class ConversationBase(BaseModel):
    id: int
    property_id: int
    buyer_id: int
    agent_id: int
    last_message_at: datetime
    last_message_preview: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationDetail(ConversationBase):
    # Property details
    property_title: Optional[str] = None
    property_price: Optional[float] = None
    property_city: Optional[str] = None
    
    # Other participant info
    other_user_id: Optional[int] = None
    other_user_name: Optional[str] = None
    other_user_email: Optional[str] = None
    
    # Unread count
    unread_count: int = 0
    
    class Config:
        from_attributes = True


class ConversationWithMessages(ConversationDetail):
    messages: List[MessageResponse] = []
    
    class Config:
        from_attributes = True


class NotificationBase(BaseModel):
    title: str
    body: str


class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    message_id: int
    conversation_id: int
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool = True


class ChatStats(BaseModel):
    total_conversations: int
    unread_messages_count: int
    unread_notifications_count: int


# WebSocket Message
class WSMessage(BaseModel):
    type: str  # for 'message', 'notification', 'read_receipt', etc.
    data: dict