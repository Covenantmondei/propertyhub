from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth.oauth2 import get_current_user
from app.auth.models import User
from app.property.review_schemas import ReviewCreate, ReviewUpdate, ReviewResponse, AgentReviewSummary

from app.property import reviews


router = APIRouter(
    prefix="/reviews",
    tags=["reviews"]
)


@router.post("/", response_model=ReviewResponse)
def create_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a review for an agent after a completed visit"""
    if current_user.role != "buyer":
        raise HTTPException(status_code=403, detail="Only buyers can create reviews")
    return reviews.create_review(db, review_data, current_user.id)


@router.put("/update/{review_id}", response_model=ReviewResponse)
def update_review(review_id: int, review_data: ReviewUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update an existing review"""
    return reviews.update_review(db, review_id, current_user.id, review_data)


@router.delete("del/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    """Delete a review"""
    return reviews.delete_review(db, review_id, current_user.id)


@router.get("/agent/{agent_id}", response_model=AgentReviewSummary)
def get_agent_reviews(
    agent_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all reviews for a specific agent with summary statistics"""
    return reviews.get_agent_reviews(db, agent_id, skip, limit)


@router.get("/my-reviews", response_model=List[ReviewResponse])
def get_my_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all reviews written by the current buyer"""
    return reviews.get_buyer_reviews(db, current_user.id, skip, limit)


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int,db: Session = Depends(get_db)):
    """Get a specific review by ID"""
    return reviews.get_review_by_id(db, review_id)


@router.get("/check/{visit_id}")
def check_can_review(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if current user can review a visit"""
    return reviews.check_can_review(db, visit_id, current_user.id)