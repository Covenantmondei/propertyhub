from typing import List, Optional
from fastapi import WebSocket, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from datetime import datetime

from app.auth.models import User, UserRole
from app.chat.models import Conversation, Message, Notification
from app.chat.schemas import (
    ConversationCreate, ConversationDetail, ConversationWithMessages,
    MessageResponse, NotificationResponse, ChatStats, MessageBase
)
from app.property.models import UserProperty


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                # Connection closed
                self.disconnect(user_id)


manager = ConnectionManager()


# Helper Functions
def create_notification(db: Session, user_id: int, message: Message, conversation: Conversation) -> Notification:
    """Create a notification for a new message"""
    sender_name = f"{message.sender.first_name} {message.sender.last_name}"
    
    notification = Notification(
        user_id=user_id,
        message_id=message.id,
        conversation_id=conversation.id,
        title=f"New message from {sender_name}",
        body=message.content[:100] + ("..." if len(message.content) > 100 else "")
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def send_notification(user_id: int, notification_data: dict):
    """Send notification through WebSocket if user is connected"""
    await manager.send_personal_message({
        "type": "notification",
        "data": notification_data
    }, user_id)


async def send_message(user_id: int, message_data: dict):
    """Send message through WebSocket"""
    await manager.send_personal_message({
        "type": "message",
        "data": message_data
    }, user_id)


async def send_read_receipt(user_id: int, conversation_id: int, message_ids: List[int]):
    """Send read receipt through WebSocket"""
    await manager.send_personal_message({
        "type": "read_receipt",
        "conversation_id": conversation_id,
        "message_ids": message_ids
    }, user_id)


def create_new_conversation(
    db: Session,
    request: ConversationCreate,
    current_user: User
) -> ConversationDetail:
    
    if current_user.role != UserRole.BUYER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only buyers can initiate conversations"
        )
    
    property_obj = db.query(UserProperty).filter(UserProperty.id == request.property_id).first()
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check if conversation already exists
    existing_conv = db.query(Conversation).filter(
        and_(
            Conversation.property_id == request.property_id,
            Conversation.buyer_id == current_user.id
        )
    ).first()
    
    if existing_conv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation already exists for this property"
        )
    
    # Create conversation
    conversation = Conversation(
        property_id=request.property_id,
        buyer_id=current_user.id,
        agent_id=property_obj.agent_id,
        last_message_preview=request.message[:200]
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=request.message
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    return ConversationDetail(
        **conversation.__dict__,
        property_title=property_obj.title,
        property_price=property_obj.price,
        property_city=property_obj.city,
        other_user_id=property_obj.agent_id,
        other_user_name=f"{property_obj.agent.first_name} {property_obj.agent.last_name}",
        other_user_email=property_obj.agent.email,
        unread_count=0
    ), message, property_obj.agent_id, conversation


def get_user_conversations(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 20
) -> List[ConversationDetail]:
    
    conversations = db.query(Conversation).filter(
        or_(
            Conversation.buyer_id == current_user.id,
            Conversation.agent_id == current_user.id
        )
    ).order_by(desc(Conversation.last_message_at)).offset(skip).limit(limit).all()
    
    result = []
    for conv in conversations:
        is_buyer = conv.buyer_id == current_user.id
        other_user = conv.agent if is_buyer else conv.buyer
        
        # Count unread messages
        unread_count = db.query(Message).filter(
            and_(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user.id,
                Message.is_read == False
            )
        ).count()
        
        result.append(ConversationDetail(
            **conv.__dict__,
            property_title=conv.property.title,
            property_price=conv.property.price,
            property_city=conv.property.city,
            other_user_id=other_user.id,
            other_user_name=f"{other_user.first_name} {other_user.last_name}",
            other_user_email=other_user.email,
            unread_count=unread_count
        ))
    
    return result


def get_conversation_with_messages(
    db: Session,
    conversation_id: int,
    current_user: User,
    message_limit: int = 50
) -> tuple[ConversationWithMessages, Optional[int], Optional[List[int]]]:
    """Get conversation details with messages"""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.buyer_id != current_user.id and conversation.agent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this conversation"
        )
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(desc(Message.created_at)).limit(message_limit).all()
    # Show oldest first
    messages.reverse() 
    
    # Mark messages as read
    unread_messages = [msg for msg in messages if msg.sender_id != current_user.id and not msg.is_read]
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = datetime.utcnow()
    
    other_user_id = None
    message_ids = None
    
    if unread_messages:
        db.commit()
        # Prepare data for read receipt
        other_user_id = conversation.agent_id if conversation.buyer_id == current_user.id else conversation.buyer_id
        message_ids = [msg.id for msg in unread_messages]
    
    # Format messages
    message_responses = []
    for msg in messages:
        message_responses.append(MessageResponse(
            **msg.__dict__,
            sender_name=f"{msg.sender.first_name} {msg.sender.last_name}"
        ))
    
    # Determine the other user
    is_buyer = conversation.buyer_id == current_user.id
    other_user = conversation.agent if is_buyer else conversation.buyer
    
    conversation_with_messages = ConversationWithMessages(
        **conversation.__dict__,
        property_title=conversation.property.title,
        property_price=conversation.property.price,
        property_city=conversation.property.city,
        other_user_id=other_user.id,
        other_user_name=f"{other_user.first_name} {other_user.last_name}",
        other_user_email=other_user.email,
        unread_count=0,
        messages=message_responses
    )
    
    return conversation_with_messages, other_user_id, message_ids


def create_message(
    db: Session,
    conversation_id: int,
    request: MessageBase,
    current_user: User
) -> tuple[MessageResponse, int, Message, Conversation]:
    """Create a new message in a conversation"""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.buyer_id != current_user.id and conversation.agent_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this conversation"
        )
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=request.content
    )
    db.add(message)
    
    # Update conversation
    conversation.last_message_at = datetime.utcnow()
    conversation.last_message_preview = request.content[:200]
    
    db.commit()
    db.refresh(message)
    
    # Determine recipient
    recipient_id = conversation.agent_id if conversation.buyer_id == current_user.id else conversation.buyer_id
    
    message_response = MessageResponse(
        **message.__dict__,
        sender_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    return message_response, recipient_id, message, conversation


def get_user_notifications(
    db: Session,
    current_user: User,
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 20
) -> List[NotificationResponse]:
    """Get notifications for the current user"""
    
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit).all()
    
    return [NotificationResponse(**notif.__dict__) for notif in notifications]


def mark_notification_read(
    db: Session,
    notification_id: int,
    current_user: User
) -> NotificationResponse:
    """Mark a notification as read"""
    
    notification = db.query(Notification).filter(
        and_(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    
    db.commit()
    db.refresh(notification)
    
    return NotificationResponse(**notification.__dict__)


def mark_all_notifications_read(db: Session, current_user: User) -> dict:
    """Mark all notifications as read for the current user"""
    
    db.query(Notification).filter(
        and_(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    })
    
    db.commit()
    
    return {"message": "All notifications marked as read"}


def get_user_chat_stats(db: Session, current_user: User) -> ChatStats:
    """Get chat statistics for the current user"""
    
    total_conversations = db.query(Conversation).filter(
        or_(
            Conversation.buyer_id == current_user.id,
            Conversation.agent_id == current_user.id
        )
    ).count()
    
    conversation_ids = db.query(Conversation.id).filter(
        or_(
            Conversation.buyer_id == current_user.id,
            Conversation.agent_id == current_user.id
        )
    ).all()
    conversation_ids = [c[0] for c in conversation_ids]
    
    unread_messages_count = db.query(Message).filter(
        and_(
            Message.conversation_id.in_(conversation_ids),
            Message.sender_id != current_user.id,
            Message.is_read == False
        )
    ).count() if conversation_ids else 0
    
    unread_notifications_count = db.query(Notification).filter(
        and_(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    ).count()
    
    return ChatStats(
        total_conversations=total_conversations,
        unread_messages_count=unread_messages_count,
        unread_notifications_count=unread_notifications_count
    )