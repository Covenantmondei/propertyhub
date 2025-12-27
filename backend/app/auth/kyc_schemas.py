from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


class KYCSubmission(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=20)
    id_type: str = Field(..., pattern="^(passport|drivers_license|national_id)$")
    id_number: str = Field(..., min_length=5, max_length=50)
    company: Optional[str] = Field(None, max_length=200)


class KYCDocumentUpload(BaseModel):
    """Response after uploading KYC documents"""
    government_id_url: str
    selfie_url: str


class KYCStatusUpdate(BaseModel):
    """Admin updates KYC status"""
    status: str = Field(..., pattern="^(verified|rejected|suspended)$")
    rejection_reason: Optional[str] = Field(None, max_length=500)


class KYCDisplay(BaseModel):
    user_id: int
    kyc_status: str
    phone_number: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    government_id_url: Optional[str] = None
    selfie_url: Optional[str] = None
    company: Optional[str] = None
    kyc_submitted_at: Optional[datetime] = None
    kyc_verified_at: Optional[datetime] = None
    kyc_rejection_reason: Optional[str] = None
    
    # User info
    first_name: str
    last_name: str
    email: str
    username: str
    
    # Agent stats
    rating: Optional[float] = None
    ranking_score: Optional[float] = None
    no_show_count: int = 0
    declined_visits_count: int = 0
    completed_visits_count: int = 0
    
    class Config:
        from_attributes = True


class AgentWarning(BaseModel):
    """Warning notification for agents"""
    warning_type: str
    message: str
    severity: str  # low, medium, high
    action_required: Optional[str] = None