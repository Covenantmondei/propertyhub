from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, timedelta
import json

from app.auth.models import User, AgentProfile, ActivityLog, UserRole, ApprovalStatus
from app.property.models import UserProperty


def is_admin(user_role: str):
    """Check if user is admin"""
    if user_role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


def log_activity(db: Session, user_id: Optional[int], admin_id: Optional[int], 
                 action: str, entity_type: Optional[str] = None, 
                 entity_id: Optional[int] = None, details: Optional[dict] = None,
                 ip_address: Optional[str] = None):
    """Log user/admin activity"""
    activity = ActivityLog(
        user_id=user_id,
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details) if details else None,
        ip_address=ip_address
    )
    db.add(activity)
    db.commit()


def get_pending_agents(db: Session, skip: int = 0, limit: int = 20):
    """Get all agents pending approval"""
    agents = db.query(User).filter(
        and_(
            User.role == UserRole.AGENT.value,
            User.approval_status == ApprovalStatus.PENDING.value
        )
    ).offset(skip).limit(limit).all()
    
    return agents


def approve_agent(db: Session, agent_id: int, admin_id: int):
    """Approve an agent account"""
    agent = db.query(User).filter(User.id == agent_id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    if agent.role != UserRole.AGENT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an agent"
        )
    
    agent.is_approved = True
    agent.approval_status = ApprovalStatus.APPROVED.value
    
    # Log activity
    log_activity(
        db, 
        user_id=agent_id, 
        admin_id=admin_id, 
        action="agent_approved",
        entity_type="user",
        entity_id=agent_id
    )
    
    db.commit()
    db.refresh(agent)
    
    return {
        "message": "Agent approved successfully",
        "agent_id": agent_id,
        "username": agent.username,
        "email": agent.email
    }


def reject_agent(db: Session, agent_id: int, admin_id: int, reason: str):
    """Reject an agent account"""
    agent = db.query(User).filter(User.id == agent_id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    if agent.role != UserRole.AGENT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an agent"
        )
    
    agent.is_approved = False
    agent.approval_status = ApprovalStatus.REJECTED.value
    
    # Log activity
    log_activity(
        db, 
        user_id=agent_id, 
        admin_id=admin_id, 
        action="agent_rejected",
        entity_type="user",
        entity_id=agent_id,
        details={"reason": reason}
    )
    
    db.commit()
    db.refresh(agent)
    
    return {
        "message": "Agent rejected",
        "agent_id": agent_id,
        "reason": reason
    }


def get_pending_properties(db: Session, skip: int = 0, limit: int = 20):
    """Get all properties pending approval"""
    properties = db.query(UserProperty).filter(
        UserProperty.approval_status == ApprovalStatus.PENDING.value
    ).offset(skip).limit(limit).all()
    
    return properties


def approve_property(db: Session, property_id: int, admin_id: int):
    """Approve a property listing"""
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    property.is_approved = True
    property.approval_status = ApprovalStatus.APPROVED.value
    property.is_available = True
    
    # Log activity
    log_activity(
        db, 
        user_id=property.agent_id, 
        admin_id=admin_id, 
        action="property_approved",
        entity_type="property",
        entity_id=property_id
    )
    
    db.commit()
    db.refresh(property)
    
    return {
        "message": "Property approved successfully",
        "property_id": property_id,
        "title": property.title
    }


def reject_property(db: Session, property_id: int, admin_id: int, reason: str):
    """Reject a property listing"""
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    property.is_approved = False
    property.approval_status = ApprovalStatus.REJECTED.value
    property.rejection_reason = reason
    property.is_available = False
    
    # Log activity
    log_activity(
        db, 
        user_id=property.agent_id, 
        admin_id=admin_id, 
        action="property_rejected",
        entity_type="property",
        entity_id=property_id,
        details={"reason": reason}
    )
    
    db.commit()
    db.refresh(property)
    
    return {
        "message": "Property rejected",
        "property_id": property_id,
        "reason": reason
    }


def get_all_users(db: Session, role: Optional[str] = None, skip: int = 0, limit: int = 20):
    """Get all users with optional role filter"""
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    
    users = query.offset(skip).limit(limit).all()
    return users


def get_dashboard_stats(db: Session):
    """Get admin dashboard statistics"""
    total_users = db.query(func.count(User.id)).scalar()
    total_agents = db.query(func.count(User.id)).filter(User.role == UserRole.AGENT.value).scalar()
    pending_agents = db.query(func.count(User.id)).filter(
        and_(User.role == UserRole.AGENT.value, User.approval_status == ApprovalStatus.PENDING.value)
    ).scalar()
    approved_agents = db.query(func.count(User.id)).filter(
        and_(User.role == UserRole.AGENT.value, User.approval_status == ApprovalStatus.APPROVED.value)
    ).scalar()
    
    total_properties = db.query(func.count(UserProperty.id)).scalar()
    pending_properties = db.query(func.count(UserProperty.id)).filter(
        UserProperty.approval_status == ApprovalStatus.PENDING.value
    ).scalar()
    approved_properties = db.query(func.count(UserProperty.id)).filter(
        UserProperty.approval_status == ApprovalStatus.APPROVED.value
    ).scalar()
    
    # Pending KYC submissions
    pending_kyc = db.query(func.count(User.id)).filter(
        and_(User.role == UserRole.AGENT.value, User.kyc_status == "pending_review")
    ).scalar()
    
    # Recent activity (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = db.query(func.count(User.id)).filter(
        User.created_at >= seven_days_ago
    ).scalar()
    recent_properties = db.query(func.count(UserProperty.id)).filter(
        UserProperty.created_at >= seven_days_ago
    ).scalar()
    
    # Calculate total pending approvals
    total_pending = (pending_agents or 0) + (pending_properties or 0) + (pending_kyc or 0)
    
    return {
        "total_users": total_users or 0,
        "total_properties": total_properties or 0,
        "total_agents": total_agents or 0,
        "pending_approvals": total_pending,
        "pending_agents": pending_agents or 0,
        "pending_properties": pending_properties or 0,
        "pending_kyc": pending_kyc or 0,
        "approved_agents": approved_agents or 0,
        "approved_properties": approved_properties or 0,
        "users": {
            "total": total_users or 0,
            "total_agents": total_agents or 0,
            "pending_agents": pending_agents or 0,
            "approved_agents": approved_agents or 0,
            "recent_registrations": recent_registrations or 0
        },
        "properties": {
            "total": total_properties or 0,
            "pending": pending_properties or 0,
            "approved": approved_properties or 0,
            "recent": recent_properties or 0
        }
    }


def get_activity_logs(db: Session, user_id: Optional[int] = None, 
                      action: Optional[str] = None, days: int = 7,
                      skip: int = 0, limit: int = 50):
    """Get activity logs with filters"""
    query = db.query(ActivityLog)
    
    # Filter by date
    start_date = datetime.utcnow() - timedelta(days=days)
    query = query.filter(ActivityLog.created_at >= start_date)
    
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    
    if action:
        query = query.filter(ActivityLog.action == action)
    
    logs = query.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


def suspend_user(db: Session, user_id: int, admin_id: int, reason: str):
    """Suspend a user account"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.role == UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend admin users"
        )
    
    user.is_approved = False
    user.approval_status = ApprovalStatus.REJECTED.value
    
    # Also disable all their properties if agent
    if user.role == UserRole.AGENT.value:
        db.query(UserProperty).filter(UserProperty.agent_id == user_id).update(
            {"is_available": False}
        )
    
    # Log activity
    log_activity(
        db, 
        user_id=user_id, 
        admin_id=admin_id, 
        action="user_suspended",
        entity_type="user",
        entity_id=user_id,
        details={"reason": reason}
    )
    
    db.commit()
    
    return {
        "message": "User suspended successfully",
        "user_id": user_id,
        "reason": reason
    }


def unsuspend_user(db: Session, user_id: int, admin_id: int):
    """Unsuspend a user account"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_approved = True
    user.approval_status = ApprovalStatus.APPROVED.value
    
    # Log activity
    log_activity(
        db, 
        user_id=user_id, 
        admin_id=admin_id, 
        action="user_unsuspended",
        entity_type="user",
        entity_id=user_id
    )
    
    db.commit()
    
    return {
        "message": "User unsuspended successfully",
        "user_id": user_id
    }

def get_pending_kyc(db: Session, skip: int = 0, limit: int = 20):
    """Get all pending KYC submissions"""
    agents = db.query(User).filter(
        and_(
            User.role == UserRole.AGENT.value,
            User.kyc_status == "pending_review"
        )
    ).offset(skip).limit(limit).all()
    
    return agents