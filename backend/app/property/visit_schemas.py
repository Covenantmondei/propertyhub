from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


class VisitRequestCreate(BaseModel):
    property_id: int
    visit_type: str = Field(..., pattern="^(physical|virtual)$")
    preferred_date: datetime
    preferred_time_start: str = Field(..., pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    preferred_time_end: str = Field(..., pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    buyer_note: Optional[str] = Field(None, max_length=500)
    
    @validator('preferred_date')
    def validate_future_date(cls, v):
        if v < datetime.utcnow():
            raise ValueError('Preferred date must be in the future')
        return v
    
    @validator('preferred_time_end')
    def validate_time_range(cls, v, values):
        if 'preferred_time_start' in values:
            start = values['preferred_time_start']
            if v <= start:
                raise ValueError('End time must be after start time')
        return v


class VisitRequestResponse(BaseModel):
    status: str
    proposed_date: Optional[datetime] = None
    proposed_time_start: Optional[str] = None
    proposed_time_end: Optional[str] = None
    agent_note: Optional[str] = Field(None, max_length=500)


class VisitRequestDecline(BaseModel):
    decline_reason: str = Field(..., min_length=10, max_length=500)


class VisitRequestConfirm(BaseModel):
    """Buyer confirms agent's proposed time"""
    pass


class VisitRequestComplete(BaseModel):
    """Mark visit as completed or no-show"""
    status: str = Field(..., pattern="^(completed|no_show_buyer|no_show_agent|cancelled)$")
    notes: Optional[str] = Field(None, max_length=500)


class VisitRequestDisplay(BaseModel):
    id: int
    property_id: int
    buyer_id: int
    agent_id: int
    visit_type: str
    status: str
    
    # Buyer's request
    preferred_date: datetime
    preferred_time_start: str
    preferred_time_end: str
    buyer_note: Optional[str] = None
    
    # Agent's response
    proposed_date: Optional[datetime] = None
    proposed_time_start: Optional[str] = None
    proposed_time_end: Optional[str] = None
    agent_note: Optional[str] = None
    
    # Confirmed details
    confirmed_date: Optional[datetime] = None
    confirmed_time_start: Optional[str] = None
    confirmed_time_end: Optional[str] = None
    
    decline_reason: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    
    # Property info
    property_title: Optional[str] = None
    property_address: Optional[str] = None
    property_city: Optional[str] = None
    
    # User info
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None
    
    class Config:
        from_attributes = True