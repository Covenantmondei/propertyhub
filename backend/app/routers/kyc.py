from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.auth.models import User
from app.database import get_db
from app.auth.oauth2 import get_current_user
from app.auth.kyc_schemas import KYCSubmission, KYCStatusUpdate, KYCDisplay, AgentWarning
from app.auth import kyc


router = APIRouter(
    prefix="/kyc",
    tags=["KYC Verification"],
)


@router.post("/submit", response_model=KYCDisplay)
def submit_kyc_info(request: KYCSubmission, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Agent submits KYC information"""
    if current_user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can submit KYC"
        )
    
    return kyc.submit_kyc(db, current_user.id, request)


@router.post("/upload")
async def upload_kyc_documents(
    government_id: UploadFile = File(..., description="Government issued ID (passport, driver's license, or national ID)"),
    selfie: UploadFile = File(..., description="Selfie holding the ID document"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload KYC documents (government ID and selfie)"""
    if current_user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can upload KYC documents"
        )
    
    # Validate file types
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "application/pdf"]
    
    if government_id.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Government ID must be an image (JPEG, PNG) or PDF"
        )
    
    if selfie.content_type not in ["image/jpeg", "image/jpg", "image/png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selfie must be an image (JPEG, PNG)"
        )
    
    return await kyc.upload_kyc_documents(db, current_user.id, government_id, selfie)


@router.get("/status", response_model=KYCDisplay)
def get_my_kyc_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user's KYC status"""
    return kyc.get_agent_kyc(db, current_user.id)


@router.get("/eligibility")
def check_my_eligibility(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check if agent is eligible to perform actions (create properties, accept visits, etc.)"""
    if current_user.role != "agent":
        return {
            "eligible": False,
            "reason": "Only agents need KYC verification"
        }
    
    return kyc.check_agent_eligibility(db, current_user.id)


