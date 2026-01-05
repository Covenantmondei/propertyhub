from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from app.property.models import VisitRequest, UserProperty, VisitStatus
from app.auth.models import User
from app.property.visit_schemas import VisitRequestCreate, VisitRequestResponse, VisitRequestDecline, VisitRequestComplete, VisitRequestDisplay
from app.auth.kyc import check_agent_eligibility, check_buyer_active_requests, update_agent_ranking, flag_buyer_for_abuse, check_buyer_no_shows
from app.chat.models import Notification




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
    
    # Check if property exists and available
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
    
    # Check if buyer has too many active requests
    if check_buyer_active_requests(db, buyer_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum of active visit requests"
        )
    
    # Check if buyer is flagged
    buyer = db.query(User).filter(User.id == buyer_id).first()
    if buyer.is_flagged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account has been flagged: {buyer.flag_reason}. Please contact support."
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
    
    # Create notification for agent
    buyer_name = f"{buyer.first_name} {buyer.last_name}"
    notification = Notification(
        user_id=property_obj.agent_id,
        notification_type="visit_request",
        related_id=visit_request.id,
        title="New Visit Request",
        body=f"{buyer_name} has requested to visit your property '{property_obj.title}' on {visit_request.preferred_date.strftime('%B %d, %Y')} at {visit_request.preferred_time_start}"
    )
    db.add(notification)
    db.commit()
    
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
    
    # Create notification for buyer
    agent = db.query(User).filter(User.id == agent_id).first()
    property_obj = db.query(UserProperty).filter(UserProperty.id == visit.property_id).first()
    agent_name = f"{agent.first_name} {agent.last_name}"
    notification = Notification(
        user_id=visit.buyer_id,
        notification_type="visit_confirmed",
        related_id=visit.id,
        title="Visit Confirmed",
        body=f"{agent_name} has confirmed your visit to '{property_obj.title}' on {visit.confirmed_date.strftime('%B %d, %Y')} at {visit.confirmed_time_start}"
    )
    db.add(notification)
    db.commit()
    
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
    now = datetime.now(timezone.utc)
    proposed = response.proposed_date
    if proposed.tzinfo is None:
        proposed = proposed.replace(tzinfo=timezone.utc)
    
    if proposed < now:
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
    
    # Create notification for buyer
    agent = db.query(User).filter(User.id == agent_id).first()
    property_obj = db.query(UserProperty).filter(UserProperty.id == visit.property_id).first()
    agent_name = f"{agent.first_name} {agent.last_name}"
    notification = Notification(
        user_id=visit.buyer_id,
        notification_type="visit_reschedule",
        related_id=visit.id,
        title="New Time Proposed",
        body=f"{agent_name} has proposed a new time for your visit to '{property_obj.title}': {visit.proposed_date.strftime('%B %d, %Y')} at {visit.proposed_time_start}"
    )
    db.add(notification)
    db.commit()
    
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
    
    # Track decline
    agent = db.query(User).filter(User.id == agent_id).first()
    agent.declined_visits_count += 1
    
    # Update ranking
    warnings = update_agent_ranking(db, agent_id, "decline_visit")
    
    db.commit()
    db.refresh(visit)
    
    # Create notification for buyer
    property_obj = db.query(UserProperty).filter(UserProperty.id == visit.property_id).first()
    agent_name = f"{agent.first_name} {agent.last_name}"
    notification = Notification(
        user_id=visit.buyer_id,
        notification_type="visit_declined",
        related_id=visit.id,
        title="Visit Request Declined",
        body=f"{agent_name} has declined your visit request for '{property_obj.title}'. Reason: {decline.decline_reason or 'Not specified'}"
    )
    db.add(notification)
    db.commit()
    
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
    
    # Create notification for agent
    buyer = db.query(User).filter(User.id == buyer_id).first()
    property_obj = db.query(UserProperty).filter(UserProperty.id == visit.property_id).first()
    buyer_name = f"{buyer.first_name} {buyer.last_name}"
    notification = Notification(
        user_id=visit.agent_id,
        notification_type="visit_confirmed",
        related_id=visit.id,
        title="Visit Time Confirmed",
        body=f"{buyer_name} has confirmed the visit to '{property_obj.title}' on {visit.confirmed_date.strftime('%B %d, %Y')} at {visit.confirmed_time_start}"
    )
    db.add(notification)
    db.commit()
    
    return build_visit_display(db, visit)


def complete_visit(db: Session, visit_id: int, user_id: int, completion: VisitRequestComplete):
    """Mark visit as completed or no-show (agent or system)"""
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
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
    
    # Update statistics
    buyer = db.query(User).filter(User.id == visit.buyer_id).first()
    agent = db.query(User).filter(User.id == visit.agent_id).first()
    
    if completion.status == "completed":
        # Both parties showed up
        buyer.completed_visits_count += 1
        agent.completed_visits_count += 1
        update_agent_ranking(db, agent.id, "complete_visit")
        
    elif completion.status == "no_show_buyer":
        # Buyer didn't show up
        buyer.no_show_count += 1
        check_buyer_no_shows(db, buyer.id)  # Flag if threshold exceeded
        
    elif completion.status == "no_show_agent":
        # Agent didn't show up
        agent.no_show_count += 1
        warnings = update_agent_ranking(db, agent.id, "no_show")
    
    db.commit()
    db.refresh(visit)
    
    # Create notification for buyer when visit is completed
    property_obj = db.query(UserProperty).filter(UserProperty.id == visit.property_id).first()
    agent_name = f"{agent.first_name} {agent.last_name}"
    
    if completion.status == "completed":
        notification = Notification(
            user_id=visit.buyer_id,
            notification_type="visit_completed",
            related_id=visit.id,
            title="Visit Completed",
            body=f"Your visit to '{property_obj.title}' has been completed. Please take a moment to review your experience with {agent_name}."
        )
        db.add(notification)
        db.commit()
    
    return build_visit_display(db, visit)


# Add new function to mark buyer as interested
def mark_buyer_interested(db: Session, visit_id: int, agent_id: int):
    """Agent marks buyer as interested after completed visit"""
    visit = get_visit_and_verify_agent(db, visit_id, agent_id)
    
    if visit.status != VisitStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only mark interest for completed visits"
        )
    
    if visit.is_buyer_interested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buyer already marked as interested"
        )
    
    visit.is_buyer_interested = True
    visit.marked_interested_at = datetime.utcnow()
    
    db.commit()
    db.refresh(visit)
    
    return {
        "message": "Buyer marked as interested",
        "visit_id": visit.id,
        "can_create_reservation": True
    }


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