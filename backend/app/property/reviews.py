from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, cast, Integer
from datetime import datetime
from typing import List, Optional

from app.property.models import AgentReview, VisitRequest, UserProperty, VisitStatus
from app.auth.models import User, AgentProfile
from app.property.review_schemas import ReviewCreate, ReviewUpdate, ReviewResponse, AgentReviewSummary


def create_review(db: Session, review_data: ReviewCreate, buyer_id: int) -> ReviewResponse:
    """Buyer creates a review for an agent after a completed visit"""
    
    # Get the visit request
    visit = db.query(VisitRequest).filter(VisitRequest.id == review_data.visit_request_id).first()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit request not found"
        )
    
    # Verify the buyer is the one who made the visit request
    if visit.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review visits you participated in"
        )
    
    # Check if visit is completed
    if visit.status != VisitStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review completed visits"
        )
    
    # Check if review already exists
    existing_review = db.query(AgentReview).filter(
        AgentReview.visit_request_id == review_data.visit_request_id
    ).first()
    
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this visit"
        )
    
    # Create the review
    review = AgentReview(
        agent_id=visit.agent_id,
        buyer_id=buyer_id,
        visit_request_id=review_data.visit_request_id,
        property_id=visit.property_id,
        rating=review_data.rating,
        review_text=review_data.review_text,
        communication_rating=review_data.communication_rating,
        professionalism_rating=review_data.professionalism_rating,
        knowledge_rating=review_data.knowledge_rating,
        responsiveness_rating=review_data.responsiveness_rating,
        would_recommend=review_data.would_recommend
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Update agent's average rating
    update_agent_rating(db, visit.agent_id)
    
    return build_review_response(db, review)



def update_review(db: Session, review_id: int, buyer_id: int, review_data: ReviewUpdate) -> ReviewResponse:
    """Update an existing review"""
    
    review = db.query(AgentReview).filter(AgentReview.id == review_id).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Verify the buyer is the owner of the review
    if review.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own reviews"
        )
    
    # Update fields
    if review_data.rating is not None:
        review.rating = review_data.rating
    if review_data.review_text is not None:
        review.review_text = review_data.review_text
    if review_data.communication_rating is not None:
        review.communication_rating = review_data.communication_rating
    if review_data.professionalism_rating is not None:
        review.professionalism_rating = review_data.professionalism_rating
    if review_data.knowledge_rating is not None:
        review.knowledge_rating = review_data.knowledge_rating
    if review_data.responsiveness_rating is not None:
        review.responsiveness_rating = review_data.responsiveness_rating
    if review_data.would_recommend is not None:
        review.would_recommend = review_data.would_recommend
    
    review.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(review)
    
    # Update agent's average rating
    update_agent_rating(db, review.agent_id)
    
    return build_review_response(db, review)



def delete_review(db: Session, review_id: int, buyer_id: int):
    """Delete a review"""
    
    review = db.query(AgentReview).filter(AgentReview.id == review_id).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Verify the buyer is the owner of the review
    if review.buyer_id != buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own reviews"
        )
    
    agent_id = review.agent_id
    
    db.delete(review)
    db.commit()
    
    # Update agent's average rating
    update_agent_rating(db, agent_id)
    
    return {"message": "Review deleted successfully"}




def get_agent_reviews(db: Session, agent_id: int, skip: int = 0, limit: int = 20) -> AgentReviewSummary:
    """Get all reviews for an agent with summary statistics"""
    
    # Verify agent exists
    agent = db.query(User).filter(User.id == agent_id, User.role == "agent").first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get all reviews for this agent
    reviews = db.query(AgentReview).filter(
        AgentReview.agent_id == agent_id,
        AgentReview.is_flagged == False
    ).order_by(AgentReview.created_at.desc()).offset(skip).limit(limit).all()
    
    # Calculate statistics
    total_reviews = db.query(func.count(AgentReview.id)).filter(
        AgentReview.agent_id == agent_id,
        AgentReview.is_flagged == False
    ).scalar()
    
    if total_reviews == 0:
        return AgentReviewSummary(
            agent_id=agent_id,
            agent_name=f"{agent.first_name} {agent.last_name}",
            average_rating=0.0,
            total_reviews=0,
            average_communication=None,
            average_professionalism=None,
            average_knowledge=None,
            average_responsiveness=None,
            recommendation_percentage=0.0,
            reviews=[]
        )
    
    # Calculate averages
    stats = db.query(
        func.avg(AgentReview.rating).label('avg_rating'),
        func.avg(AgentReview.communication_rating).label('avg_communication'),
        func.avg(AgentReview.professionalism_rating).label('avg_professionalism'),
        func.avg(AgentReview.knowledge_rating).label('avg_knowledge'),
        func.avg(AgentReview.responsiveness_rating).label('avg_responsiveness'),
        func.sum(func.cast(AgentReview.would_recommend, Integer)).label('recommend_count')
    ).filter(
        AgentReview.agent_id == agent_id,
        AgentReview.is_flagged == False
    ).first()
    
    recommendation_percentage = (stats.recommend_count / total_reviews * 100) if total_reviews > 0 else 0
    
    return AgentReviewSummary(
        agent_id=agent_id,
        agent_name=f"{agent.first_name} {agent.last_name}",
        average_rating=round(stats.avg_rating, 2) if stats.avg_rating else 0.0,
        total_reviews=total_reviews,
        average_communication=round(stats.avg_communication, 2) if stats.avg_communication else None,
        average_professionalism=round(stats.avg_professionalism, 2) if stats.avg_professionalism else None,
        average_knowledge=round(stats.avg_knowledge, 2) if stats.avg_knowledge else None,
        average_responsiveness=round(stats.avg_responsiveness, 2) if stats.avg_responsiveness else None,
        recommendation_percentage=round(recommendation_percentage, 1),
        reviews=[build_review_response(db, review) for review in reviews]
    )



def get_buyer_reviews(db: Session, buyer_id: int, skip: int = 0, limit: int = 20) -> List[ReviewResponse]:
    """Get all reviews written by a buyer"""
    
    reviews = db.query(AgentReview).filter(
        AgentReview.buyer_id == buyer_id
    ).order_by(AgentReview.created_at.desc()).offset(skip).limit(limit).all()
    
    return [build_review_response(db, review) for review in reviews]



def get_review_by_id(db: Session, review_id: int) -> ReviewResponse:
    """Get a specific review"""
    
    review = db.query(AgentReview).filter(AgentReview.id == review_id).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    return build_review_response(db, review)



def check_can_review(db: Session, visit_id: int, buyer_id: int) -> dict:
    """Check if a buyer can review a visit"""
    
    visit = db.query(VisitRequest).filter(VisitRequest.id == visit_id).first()
    
    if not visit:
        return {"can_review": False, "reason": "Visit not found"}
    
    if visit.buyer_id != buyer_id:
        return {"can_review": False, "reason": "Not your visit"}
    
    if visit.status != VisitStatus.COMPLETED.value:
        return {"can_review": False, "reason": "Visit not completed"}
    
    existing_review = db.query(AgentReview).filter(
        AgentReview.visit_request_id == visit_id
    ).first()
    
    if existing_review:
        return {"can_review": False, "reason": "Already reviewed", "review_id": existing_review.id}
    
    return {"can_review": True, "visit": visit}



def update_agent_rating(db: Session, agent_id: int):
    """Recalculate and update agent's average rating"""
    
    stats = db.query(
        func.avg(AgentReview.rating).label('avg_rating'),
        func.count(AgentReview.id).label('total')
    ).filter(
        AgentReview.agent_id == agent_id,
        AgentReview.is_flagged == False
    ).first()
    
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    
    if agent_profile:
        agent_profile.rating = round(stats.avg_rating, 2) if stats.avg_rating else 5.0
        agent_profile.total_ratings = stats.total or 0
        db.commit()


def build_review_response(db: Session, review: AgentReview) -> ReviewResponse:
    """Build a complete review response with related data"""
    
    buyer = db.query(User).filter(User.id == review.buyer_id).first()
    agent = db.query(User).filter(User.id == review.agent_id).first()
    property_obj = db.query(UserProperty).filter(UserProperty.id == review.property_id).first()
    
    return ReviewResponse(
        id=review.id,
        agent_id=review.agent_id,
        buyer_id=review.buyer_id,
        visit_request_id=review.visit_request_id,
        property_id=review.property_id,
        rating=review.rating,
        review_text=review.review_text,
        communication_rating=review.communication_rating,
        professionalism_rating=review.professionalism_rating,
        knowledge_rating=review.knowledge_rating,
        responsiveness_rating=review.responsiveness_rating,
        would_recommend=review.would_recommend,
        created_at=review.created_at,
        updated_at=review.updated_at,
        buyer_name=f"{buyer.first_name} {buyer.last_name}",
        property_title=property_obj.title,
        agent_name=f"{agent.first_name} {agent.last_name}"
    )