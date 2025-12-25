from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth.oauth2 import get_current_user
from app.auth.models import User
from app.property.visit_schemas import (
    VisitRequestCreate, VisitRequestDisplay, VisitRequestResponse,
    VisitRequestDecline, VisitRequestConfirm, VisitRequestComplete
)
from app.property import visits


router = APIRouter(
    prefix="/visits",
    tags=["visits"]
)


@router.post("/request", response_model=VisitRequestDisplay)
def create_visit_request(
    request: VisitRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Buyer creates a visit request"""
    return visits.create_visit_request(db, request, current_user.id)


@router.post("/{visit_id}/accept", response_model=VisitRequestDisplay)
def accept_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Agent accepts buyer's proposed time"""
    return visits.agent_respond_accept(db, visit_id, current_user.id)


@router.post("/{visit_id}/propose", response_model=VisitRequestDisplay)
def propose_reschedule(
    visit_id: int,
    response: VisitRequestResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Agent proposes a different date/time"""
    return visits.agent_propose_reschedule(db, visit_id, current_user.id, response)


@router.post("/{visit_id}/decline", response_model=VisitRequestDisplay)
def decline_visit(
    visit_id: int,
    decline: VisitRequestDecline,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Agent declines the visit request"""
    return visits.agent_decline(db, visit_id, current_user.id, decline)


@router.post("/{visit_id}/confirm", response_model=VisitRequestDisplay)
def confirm_proposal(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Buyer confirms agent's proposed time"""
    return visits.buyer_confirm_proposal(db, visit_id, current_user.id)


@router.post("/{visit_id}/complete", response_model=VisitRequestDisplay)
def complete_visit(
    visit_id: int,
    completion: VisitRequestComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark visit as completed or no-show"""
    return visits.complete_visit(db, visit_id, current_user.id, completion)


@router.post("/{visit_id}/cancel", response_model=VisitRequestDisplay)
def cancel_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a visit (buyer or agent)"""
    return visits.cancel_visit(db, visit_id, current_user.id)


@router.get("/my-requests", response_model=List[VisitRequestDisplay])
def get_my_visits(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all visit requests (buyer's perspective)"""
    return visits.get_buyer_visits(db, current_user.id, skip, limit)


@router.get("/agent-requests", response_model=List[VisitRequestDisplay])
def get_agent_visits(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all visit requests (agent's perspective)"""
    return visits.get_agent_visits(db, current_user.id, skip, limit)


@router.get("/{visit_id}", response_model=VisitRequestDisplay)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific visit request"""
    return visits.get_visit_by_id(db, visit_id, current_user.id)