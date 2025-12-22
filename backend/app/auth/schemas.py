from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    password: str
    is_verified: bool = False
    role: str = "buyer"  # buyer or agent
    # created_at: datetime


class UserDisplay(BaseModel):
    id: int
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    is_verified: bool = False
    role: str

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class AgentProfileBase(BaseModel):
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None
    license_number: Optional[str] = None
    years_experience: Optional[int] = None


class AgentProfileDisplay(AgentProfileBase):
    id: int
    user_id: int
    profile_picture: Optional[str] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True