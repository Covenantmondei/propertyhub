from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional

from app.property.models import VisitRequest, UserProperty, VisitStatus
from app.auth.models import User
from app.property.visit_schemas import (
    VisitRequestCreate, VisitRequestResponse, VisitRequestDecline,
    VisitRequestComplete, VisitRequestDisplay
)


def create_visit_request(db: Session, request: VisitRequestCreate, buyer_id: int):
    """Buyer creates a visit request"""
    # Check for buyer
    buyer = db.query(User).filter(User.id == buyer_id).first()
    if not buyer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if buyer.role != "buyer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only buyers can request property visits"
        )
    
    # Check if property exists and is available
    property_obj = db.query(UserProperty).filter(UserProperty.id == request.property_id).first()
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    if not property_obj.is_available or not property_obj.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property is not available for visits"
        )
    
    # Check for duplicate pending requests
    existing_pending = db.query(VisitRequest).filter(
        and_(
            VisitRequest.property_id == request.property_id,
            VisitRequest.buyer_id == buyer_id,
            VisitRequest.status.in_([
                VisitStatus.PENDING.value,
                VisitStatus.PROPOSED_RESCHEDULE.value,
                VisitStatus.CONFIRMED.value
            ])
        )
    ).first()
    
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending visit request for this property"
        )
    
    # Create visit request
    visit_request = VisitRequest(
        property_id=request.property_id,
        buyer_id=buyer_id,
        agent_id=property_obj.agent_id,
        visit_type=request.visit_type,
        preferred_date=request.preferred_date,
        preferred_time_start=request.preferred_time_start,
        preferred_time_end=request.preferred_time_end,
        buyer_note=request.buyer_note,
        status=VisitStatus.PENDING.value
    )
    
    db.add(visit_request)
    db.commit()
    db.refresh(visit_request)
    
    return build_visit_display(db, visit_request)


def agent_respond_accept(db: Session, visit_id: int, agent_id: int):
    """Agent accepts the buyer's proposed time"""
    visit = get_visit_and_verify_agent(db, visit_id, agent_id)
    
    if visit.status != VisitStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only accept visits with pending status. Current status: {visit.status}"
        )
    
    # Accept and confirm the buyer's preferred time
    visit.status = VisitStatus.CONFIRMED.value
    visit.confirmed_date = visit.preferred_date
    visit.confirmed_time_start = visit.preferred_time_start
    visit.confirmed_time_end = visit.preferred_time_end
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def agent_propose_reschedule(
    db: Session,
    visit_id: int,
    agent_id: int,
    response: VisitRequestResponse
):
    """Agent proposes a different date/time"""
    visit = get_visit_and_verify_agent(db, visit_id, agent_id)
    
    if visit.status not in [VisitStatus.PENDING.value, VisitStatus.PROPOSED_RESCHEDULE.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot propose reschedule for visit with status: {visit.status}"
        )
    
    if not response.proposed_date or not response.proposed_time_start or not response.proposed_time_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide proposed date and time range"
        )
    
    # Validate proposed date is in future
    if response.proposed_date < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposed date must be in the future"
        )
    
    visit.status = VisitStatus.PROPOSED_RESCHEDULE.value
    visit.proposed_date = response.proposed_date
    visit.proposed_time_start = response.proposed_time_start
    visit.proposed_time_end = response.proposed_time_end
    visit.agent_note = response.agent_note
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def agent_decline(db: Session, visit_id: int, agent_id: int, decline: VisitRequestDecline):
    """Agent declines the visit request"""
    visit = get_visit_and_verify_agent(db, visit_id, agent_id)
    
    if visit.status not in [VisitStatus.PENDING.value, VisitStatus.PROPOSED_RESCHEDULE.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot decline visit with status: {visit.status}"
        )
    
    visit.status = VisitStatus.DECLINED.value
    visit.decline_reason = decline.decline_reason
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def buyer_confirm_proposal(db: Session, visit_id: int, buyer_id: int):
    """Buyer confirms agent's proposed time"""
    visit = get_visit_and_verify_buyer(db, visit_id, buyer_id)
    
    if visit.status != VisitStatus.PROPOSED_RESCHEDULE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only confirm visits with proposed reschedule status"
        )
    
    # Confirm the agent's proposed time
    visit.status = VisitStatus.CONFIRMED.value
    visit.confirmed_date = visit.proposed_date
    visit.confirmed_time_start = visit.proposed_time_start
    visit.confirmed_time_end = visit.proposed_time_end
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def complete_visit(
    db: Session,
    visit_id: int,
    user_id: int,
    completion: VisitRequestComplete
):
    """Mark visit as completed or no-show (agent or system)"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    # Verify user is the agent
    if visit.agent_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the property agent can mark visit completion"
        )
    
    if visit.status != VisitStatus.CONFIRMED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only complete visits with confirmed status"
        )
    
    visit.status = completion.status
    visit.agent_note = completion.notes
    visit.completed_at = datetime.utcnow()
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def cancel_visit(db: Session, visit_id: int, user_id: int):
    """Buyer or agent cancels the visit"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    # Verify user is buyer or agent
    if visit.buyer_id != user_id and visit.agent_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the buyer or agent can cancel this visit"
        )
    
    if visit.status in [
        VisitStatus.COMPLETED.value,
        VisitStatus.CANCELLED.value,
        VisitStatus.NO_SHOW_BUYER.value,
        VisitStatus.NO_SHOW_AGENT.value,
        VisitStatus.DECLINED.value
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel visit with status: {visit.status}"
        )
    
    visit.status = VisitStatus.CANCELLED.value
    visit.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return build_visit_display(db, visit)


def get_buyer_visits(db: Session, buyer_id: int, skip: int = 0, limit: int = 20):
    """Get all visit requests for a buyer"""
    visits = db.query(VisitRequest).filter(
        VisitRequest.buyer_id == buyer_id
    ).order_by(VisitRequest.created_at.desc()).offset(skip).limit(limit).all()
    
    return [build_visit_display(db, visit) for visit in visits]


def get_agent_visits(db: Session, agent_id: int, skip: int = 0, limit: int = 20):
    """Get all visit requests for an agent"""
    visits = db.query(VisitRequest).filter(
        VisitRequest.agent_id == agent_id
    ).order_by(VisitRequest.created_at.desc()).offset(skip).limit(limit).all()
    
    return [build_visit_display(db, visit) for visit in visits]


def get_visit_by_id(db: Session, visit_id: int, user_id: int):
    """Get a specific visit request"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    # Verify user is buyer or agent
    if visit.buyer_id != user_id and visit.agent_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this visit request"
        )
    
    return build_visit_display(db, visit)


# Helper functions
def get_visit_and_verify_agent(db: Session, visit_id: int, agent_id: int):
    """Get visit and verify the user is the agent"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    if visit.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the agent for this property"
        )
    
    return visit


def get_visit_and_verify_buyer(db: Session, visit_id: int, buyer_id: int):
    """Get visit and verify the user is the buyer"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    if visit.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the buyer for this visit request"
        )
    
    return visit


def build_visit_display(db: Session, visit: VisitRequest) -> VisitRequestDisplay:
    """Build a complete visit display with related data"""
    property_obj = visit.property
    buyer = visit.buyer
    agent = visit.agent
    
    return VisitRequestDisplay(
        id=visit.id,
        property_id=visit.property_id,
        buyer_id=visit.buyer_id,
        agent_id=visit.agent_id,
        visit_type=visit.visit_type,
        status=visit.status,
        preferred_date=visit.preferred_date,
        preferred_time_start=visit.preferred_time_start,
        preferred_time_end=visit.preferred_time_end,
        buyer_note=visit.buyer_note,
        proposed_date=visit.proposed_date,
        proposed_time_start=visit.proposed_time_start,
        proposed_time_end=visit.proposed_time_end,
        agent_note=visit.agent_note,
        confirmed_date=visit.confirmed_date,
        confirmed_time_start=visit.confirmed_time_start,
        confirmed_time_end=visit.confirmed_time_end,
        decline_reason=visit.decline_reason,
        created_at=visit.created_at,
        updated_at=visit.updated_at,
        completed_at=visit.completed_at,
        property_title=property_obj.title,
        property_address=property_obj.address,
        property_city=property_obj.city,
        buyer_name=f"{buyer.first_name} {buyer.last_name}",
        buyer_email=buyer.email,
        agent_name=f"{agent.first_name} {agent.last_name}",
        agent_email=agent.email
    )