from typing import List
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.oauth2 import get_current_user
from app.auth.models import User
from app.chat.schemas import ConversationCreate, ConversationDetail, ConversationWithMessages, MessageResponse, NotificationResponse, ChatStats, MessageBase

from app.chat.chat import manager, create_new_conversation, get_user_conversations, get_conversation_with_messages, create_message, get_user_notifications, mark_notification_read, mark_all_notifications_read, get_user_chat_stats, create_notification, send_notification, send_message, send_read_receipt



router = APIRouter(
    prefix='/chat',
    tags=['chat']
)


@router.post("/conversations", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new conversation"""
    conversation_detail, message, agent_id, conversation = create_new_conversation(db, request, current_user)
    
    # Create and send notification
    notification = create_notification(db, agent_id, message, conversation)
    await send_notification(agent_id, {
        "id": notification.id,
        "title": notification.title,
        "body": notification.body,
        "conversation_id": conversation_detail.id,
        "created_at": notification.created_at.isoformat()
    })
    
    return conversation_detail


@router.get("/conversations", response_model=List[ConversationDetail])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all conversations for the current user"""
    return get_user_conversations(db, current_user, skip, limit)


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation_details(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    message_limit: int = Query(50, ge=1, le=200)
):
    """Get conversation details with messages"""
    conversation_with_messages, other_user_id, message_ids = get_conversation_with_messages(
        db, conversation_id, current_user, message_limit
    )
    
    # Send read receipts if there were unread messages
    if other_user_id and message_ids:
        await send_read_receipt(other_user_id, conversation_id, message_ids)
    
    return conversation_with_messages


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_new_message(
    conversation_id: int,
    request: MessageBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message in a conversation"""
    message_response, recipient_id, message, conversation = create_message(
        db, conversation_id, request, current_user
    )
    
    # Create and send notification
    notification = create_notification(db, recipient_id, message, conversation)
    await send_notification(recipient_id, {
        "id": notification.id,
        "title": notification.title,
        "body": notification.body,
        "conversation_id": conversation.id,
        "created_at": notification.created_at.isoformat()
    })
    
    # Send message via WebSocket
    await send_message(recipient_id, {
        "id": message.id,
        "conversation_id": conversation.id,
        "sender_id": message.sender_id,
        "sender_name": f"{current_user.first_name} {current_user.last_name}",
        "content": message.content,
        "created_at": message.created_at.isoformat()
    })
    
    return message_response


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get notifications for the current user"""
    return get_user_notifications(db, current_user, unread_only, skip, limit)


@router.put("/notifications/{notification_id}", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    return mark_notification_read(db, notification_id, current_user)


@router.put("/notifications/mark-all-read")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for the current user"""
    return mark_all_notifications_read(db, current_user)


@router.get("/stats", response_model=ChatStats)
def get_chat_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get chat statistics for the current user"""
    return get_user_chat_stats(db, current_user)


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int
):
    """
    WebSocket connection for real-time chat
    Note: In production, you should authenticate the WebSocket connection
    """
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        manager.disconnect(user_id)