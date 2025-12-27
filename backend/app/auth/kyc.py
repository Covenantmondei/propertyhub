from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
import cloudinary.uploader
import os

from app.auth.models import User, AgentProfile, KYCStatus
from app.auth.kyc_schemas import KYCSubmission, KYCStatusUpdate, KYCDisplay, AgentWarning


# Anti-abuse thresholds
NO_SHOW_THRESHOLD = 3  # Flag buyer after 3 no-shows
DECLINE_THRESHOLD = 10  # Warn agent after 10 declines
MAX_ACTIVE_REQUESTS = 5  # Max active visit requests per buyer


def submit_kyc(db: Session, agent_id: int, kyc_data: KYCSubmission) -> KYCDisplay:
    """Agent submits KYC information"""
    user = db.query(User).filter(User.id == agent_id).first()
    
    if not user or user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can submit KYC"
        )
    
    if user.kyc_status == KYCStatus.VERIFIED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KYC already verified"
        )
    
    # Get or create agent profile
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    if not agent_profile:
        agent_profile = AgentProfile(user_id=agent_id)
        db.add(agent_profile)
    
    # Update agent profile with KYC data
    agent_profile.phone_number = kyc_data.phone_number
    agent_profile.id_type = kyc_data.id_type
    agent_profile.id_number = kyc_data.id_number
    agent_profile.company = kyc_data.company
    
    # Update user KYC status
    user.kyc_status = KYCStatus.PENDING_REVIEW.value
    user.kyc_submitted_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    db.refresh(agent_profile)
    
    return build_kyc_display(user, agent_profile)


async def upload_kyc_documents(db: Session, agent_id: int, government_id: UploadFile, selfie: UploadFile):
    """Upload KYC documents to Cloudinary"""
    user = db.query(User).filter(User.id == agent_id).first()
    
    if not user or user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can upload KYC documents"
        )
    
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    if not agent_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please submit KYC information first"
        )
    
    try:
        # Upload government ID
        gov_id_result = cloudinary.uploader.upload(
            government_id.file,
            folder=f"real_estate/kyc/government_ids/{agent_id}",
            resource_type="auto"
        )
        
        # Upload selfie
        selfie_result = cloudinary.uploader.upload(
            selfie.file,
            folder=f"real_estate/kyc/selfies/{agent_id}",
            resource_type="image"
        )
        
        # Update agent profile
        agent_profile.government_id_url = gov_id_result['secure_url']
        agent_profile.government_id_public_id = gov_id_result['public_id']
        agent_profile.selfie_url = selfie_result['secure_url']
        agent_profile.selfie_public_id = selfie_result['public_id']
        
        db.commit()
        
        return {
            "message": "KYC documents uploaded successfully",
            "government_id_url": agent_profile.government_id_url,
            "selfie_url": agent_profile.selfie_url
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading documents: {str(e)}"
        )


def admin_update_kyc_status(
    db: Session,
    agent_id: int,
    admin_id: int,
    update: KYCStatusUpdate
) -> KYCDisplay:
    """Admin verifies or rejects KYC"""
    user = db.query(User).filter(User.id == agent_id).first()
    
    if not user or user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    
    # Update KYC status
    user.kyc_status = update.status
    
    if update.status == "verified":
        user.kyc_verified_at = datetime.utcnow()
        user.kyc_rejection_reason = None
    elif update.status == "rejected":
        user.kyc_rejection_reason = update.rejection_reason
    
    db.commit()
    db.refresh(user)
    
    return build_kyc_display(user, agent_profile)


def get_agent_kyc(db: Session, agent_id: int) -> KYCDisplay:
    """Get agent's KYC status"""
    user = db.query(User).filter(User.id == agent_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    
    return build_kyc_display(user, agent_profile)


def get_pending_kyc(db: Session, skip: int = 0, limit: int = 20):
    """Admin: Get all pending KYC submissions"""
    users = db.query(User).filter(
        User.role == "agent",
        User.kyc_status == KYCStatus.PENDING_REVIEW.value
    ).offset(skip).limit(limit).all()
    
    result = []
    for user in users:
        agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == user.id).first()
        result.append(build_kyc_display(user, agent_profile))
    
    return result


def check_agent_eligibility(db: Session, agent_id: int) -> dict:
    """Check if agent is eligible to perform actions"""
    user = db.query(User).filter(User.id == agent_id).first()
    
    if not user or user.role != "agent":
        return {"eligible": False, "reason": "User is not an agent"}
    
    if user.kyc_status != KYCStatus.VERIFIED.value:
        return {
            "eligible": False,
            "reason": f"KYC not verified. Current status: {user.kyc_status}",
            "action_required": "Complete KYC verification"
        }
    
    if user.is_flagged:
        return {
            "eligible": False,
            "reason": f"Account flagged: {user.flag_reason}",
            "action_required": "Contact support"
        }
    
    return {"eligible": True}


def check_buyer_active_requests(db: Session, buyer_id: int) -> bool:
    """Check if buyer has reached max active requests"""
    from app.property.models import VisitRequest, VisitStatus
    
    active_count = db.query(VisitRequest).filter(
        VisitRequest.buyer_id == buyer_id,
        VisitRequest.status.in_([
            VisitStatus.PENDING.value,
            VisitStatus.PROPOSED_RESCHEDULE.value,
            VisitStatus.CONFIRMED.value
        ])
    ).count()
    
    return active_count >= MAX_ACTIVE_REQUESTS


def update_agent_ranking(db: Session, agent_id: int, action: str):
    """Update agent ranking based on behavior"""
    user = db.query(User).filter(User.id == agent_id).first()
    agent_profile = db.query(AgentProfile).filter(AgentProfile.user_id == agent_id).first()
    
    if not user or not agent_profile:
        return
    
    ranking_adjustments = {
        "complete_visit": +2,      # Completing visits increases ranking
        "decline_visit": -1,       # Declining decreases slightly
        "no_show": -5,            # No-shows hurt a lot
        "positive_review": +5,     # Good reviews boost ranking
        "negative_review": -3      # Bad reviews hurt
    }
    
    adjustment = ranking_adjustments.get(action, 0)
    agent_profile.ranking_score = max(0, min(100, agent_profile.ranking_score + adjustment))
    
    # Check if agent needs warning
    warnings = []
    
    if user.declined_visits_count >= DECLINE_THRESHOLD:
        warnings.append(AgentWarning(
            warning_type="high_decline_rate",
            message=f"You have declined {user.declined_visits_count} visits. This may affect your ranking.",
            severity="medium",
            action_required="Try to accommodate more visit requests"
        ))
    
    if user.no_show_count >= 3:
        warnings.append(AgentWarning(
            warning_type="no_show",
            message=f"You have {user.no_show_count} no-shows. Further no-shows may result in account suspension.",
            severity="high",
            action_required="Attend scheduled visits or cancel in advance"
        ))
    
    if agent_profile.ranking_score < 50:
        warnings.append(AgentWarning(
            warning_type="low_ranking",
            message="Your ranking score is below 50. This may affect your visibility.",
            severity="medium",
            action_required="Improve service quality and complete visits"
        ))
    
    db.commit()
    
    return warnings


def flag_buyer_for_abuse(db: Session, buyer_id: int, reason: str):
    """Flag buyer for abusive behavior"""
    user = db.query(User).filter(User.id == buyer_id).first()
    
    if user:
        user.is_flagged = True
        user.flag_reason = reason
        user.last_flag_date = datetime.utcnow()
        db.commit()


def check_buyer_no_shows(db: Session, buyer_id: int):
    """Check and flag buyer if too many no-shows"""
    user = db.query(User).filter(User.id == buyer_id).first()
    
    if user and user.no_show_count >= NO_SHOW_THRESHOLD:
        flag_buyer_for_abuse(
            db,
            buyer_id,
            f"Exceeded no-show threshold ({user.no_show_count} no-shows)"
        )
        return True
    
    return False


# Helper function
def build_kyc_display(user: User, agent_profile: AgentProfile = None) -> KYCDisplay:
    """Build KYC display object"""
    return KYCDisplay(
        user_id=user.id,
        kyc_status=user.kyc_status,
        phone_number=agent_profile.phone_number if agent_profile else None,
        id_type=agent_profile.id_type if agent_profile else None,
        id_number=agent_profile.id_number if agent_profile else None,
        government_id_url=agent_profile.government_id_url if agent_profile else None,
        selfie_url=agent_profile.selfie_url if agent_profile else None,
        company=agent_profile.company if agent_profile else None,
        kyc_submitted_at=user.kyc_submitted_at,
        kyc_verified_at=user.kyc_verified_at,
        kyc_rejection_reason=user.kyc_rejection_reason,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        username=user.username,
        rating=agent_profile.rating if agent_profile else None,
        ranking_score=agent_profile.ranking_score if agent_profile else None,
        no_show_count=user.no_show_count or 0,
        declined_visits_count=user.declined_visits_count or 0,
        completed_visits_count=user.completed_visits_count or 0
    )