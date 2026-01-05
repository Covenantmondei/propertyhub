from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


class ReviewCreate(BaseModel):
    visit_request_id: int
    rating: int = Field(..., ge=1, le=5, description="Overall rating from 1 to 5")
    review_text: Optional[str] = Field(None, max_length=1000)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    professionalism_rating: Optional[int] = Field(None, ge=1, le=5)
    knowledge_rating: Optional[int] = Field(None, ge=1, le=5)
    responsiveness_rating: Optional[int] = Field(None, ge=1, le=5)
    would_recommend: bool = True

    @validator('review_text')
    def validate_review_text(cls, v):
        if v and len(v.strip()) < 10:
            raise ValueError('Review text must be at least 10 characters')
        return v


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    review_text: Optional[str] = Field(None, max_length=1000)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    professionalism_rating: Optional[int] = Field(None, ge=1, le=5)
    knowledge_rating: Optional[int] = Field(None, ge=1, le=5)
    responsiveness_rating: Optional[int] = Field(None, ge=1, le=5)
    would_recommend: Optional[bool] = None


class ReviewResponse(BaseModel):
    id: int
    agent_id: int
    buyer_id: int
    visit_request_id: int
    property_id: int
    rating: int
    review_text: Optional[str]
    communication_rating: Optional[int]
    professionalism_rating: Optional[int]
    knowledge_rating: Optional[int]
    responsiveness_rating: Optional[int]
    would_recommend: bool
    created_at: datetime
    updated_at: datetime
    
    # Additional info
    buyer_name: str
    property_title: str
    agent_name: str
    
    class Config:
        from_attributes = True


class AgentReviewSummary(BaseModel):
    agent_id: int
    agent_name: str
    average_rating: float
    total_reviews: int
    average_communication: Optional[float]
    average_professionalism: Optional[float]
    average_knowledge: Optional[float]
    average_responsiveness: Optional[float]
    recommendation_percentage: float
    reviews: list[ReviewResponse]
    
    class Config:
        from_attributes = True