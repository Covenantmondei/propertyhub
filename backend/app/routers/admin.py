from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.auth.oauth2 import get_current_user
from app.auth.models import User
from app.auth.schemas import UserDisplay
from app.property.schemas import PropertyDisplay
from app.admin import admin
from app.admin.schemas import AgentRejectionRequest, PropertyRejectionRequest, UserSuspensionRequest, ActivityLogDisplay, DashboardStats
from app.auth.kyc_schemas import KYCSubmission, KYCStatusUpdate, KYCDisplay, AgentWarning
from app.auth import kyc



router = APIRouter(
    prefix='/admin',
    tags=['admin']
)


def verify_admin(current_user: User = Depends(get_current_user)):
    """Dependency to verify admin access"""    
    # Check if role is admin
    if not current_user.role or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_admin)
):
    return admin.get_dashboard_stats(db)


@router.get("/agents/pending", response_model=List[UserDisplay])
def get_pending_agents(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.get_pending_agents(db, skip, limit)


@router.post("/agents/approve")
def approve_agent(agent_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.approve_agent(db, agent_id, current_user.id)


@router.post("/agents/reject")
def reject_agent(request: AgentRejectionRequest, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.reject_agent(db, request.agent_id, current_user.id, request.reason)


@router.get("/properties/pending", response_model=List[PropertyDisplay])
def get_pending_properties(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.get_pending_properties(db, skip, limit)


@router.post("/properties/approve")
def approve_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.approve_property(db, property_id, current_user.id)


@router.post("/properties/reject")
def reject_property(request: PropertyRejectionRequest, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.reject_property(db, property_id=request.property_id, admin_id=current_user.id, reason=request.reason)


@router.get("/users", response_model=List[UserDisplay])
def get_all_users(role: Optional[str] = Query(None), skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return admin.get_all_users(db, role, skip, limit)


@router.get("/activity-logs", response_model=List[ActivityLogDisplay])
def get_activity_logs(
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_admin)
):
    return admin.get_activity_logs(db, user_id, action, days, skip, limit)


@router.post("/users/suspend")
def suspend_user(
    request: UserSuspensionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_admin)
):
    return admin.suspend_user(db, request.user_id, current_user.id, request.reason)


@router.post("/users/{user_id}/unsuspend")
def unsuspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_admin)
):
    return admin.unsuspend_user(db, user_id, current_user.id)


# KYC endpoints
@router.get("/pending", response_model=List[KYCDisplay])
def get_pending_kyc_submissions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Get all pending KYC submissions"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view pending KYC submissions"
        )
    
    return kyc.get_pending_kyc(db, skip, limit)


@router.get("/agent/{agent_id}", response_model=KYCDisplay)
def get_agent_kyc_details(agent_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin: Get specific agent's KYC details"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view agent KYC details"
        )
    
    return kyc.get_agent_kyc(db, agent_id)


@router.post("/agent/{agent_id}/verify", response_model=KYCDisplay)
def verify_agent_kyc(
    agent_id: int,
    update: KYCStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin: Verify or reject agent KYC"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can verify KYC"
        )
    
    return kyc.admin_update_kyc_status(db, agent_id, current_user.id, update)


@router.get("/agent/{agent_id}/warnings", response_model=List[AgentWarning])
def get_agent_warnings(agent_id: int, db: Session = Depends(get_db),
current_user: User = Depends(get_current_user)):
    """Admin: Get agent warnings based on behavior"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view agent warnings"
        )
    
    # Get warnings from ranking update (without actually updating)
    warnings = kyc.update_agent_ranking(db, agent_id, "check_only")
    return warnings if warnings else []