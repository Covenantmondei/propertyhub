from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PropertyImageBase(BaseModel):
    image_url: str
    is_primary: bool = False
    order: int = 0


class PropertyImageDisplay(PropertyImageBase):
    id: int
    property_id: int
    public_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AgentInfo(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True


class ImageUploadResponse(BaseModel):
    message: str
    property_id: int
    property_title: str
    images_uploaded: int
    images: List[PropertyImageDisplay]
    agent: AgentInfo
    
    class Config:
        from_attributes = True


class PropertyBase(BaseModel):
    title: str
    description: str
    property_type: str  # house, apartment, condo, land
    listing_type: str  # sale, rent
    price: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqft: Optional[float] = None
    address: str
    city: str
    state: str
    zip_code: Optional[str] = None
    country: str = "NIG"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    year_built: Optional[int] = None
    parking_spaces: Optional[int] = None
    amenities: Optional[str] = None  # JSON string


class PropertyCreate(PropertyBase):
    pass


class PropertyDisplay(PropertyBase):
    id: int
    agent_id: int
    is_available: bool
    is_approved: bool
    approval_status: str
    created_at: datetime
    updated_at: datetime
    images: List[PropertyImageDisplay] = []
    
    class Config:
        from_attributes = True


class PropertyListDisplay(BaseModel):
    id: int
    title: str
    property_type: str
    listing_type: str
    price: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqft: Optional[float] = None
    city: str
    state: str
    is_available: bool
    created_at: datetime
    primary_image: Optional[str] = None
    
    class Config:
        from_attributes = True


class FavoriteDisplay(BaseModel):
    id: int
    user_id: int
    property_id: int
    created_at: datetime
    property: PropertyListDisplay
    
    class Config:
        from_attributes = True