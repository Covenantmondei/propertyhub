from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, Query, File
from sqlalchemy.orm import Session
from typing import List, Optional

from app.auth.models import User
from app.database import get_db
from app.property.schemas import PropertyCreate, PropertyDisplay, PropertyListDisplay, SmartMatchRequest, SmartMatchProperty
from app.auth.oauth2 import get_current_user
from app.property import property


router = APIRouter(
    prefix="/properties",
    tags=["properties"],
)


@router.post("/create", response_model=PropertyDisplay)
def create_property(request: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to create a new property"""
    return property.create_property(db, request, current_user.id)


@router.post("/{property_id}/upload")
def upload_property_images(
    property_id: int, 
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Endpoint to upload property images"""
    return property.upload_property_images(db, property_id, files, current_user.id)


@router.get("/all", response_model=List[PropertyListDisplay])
def get_all_properties(
    skip: int = 0,
    limit: int = 20,
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    property_type: Optional[str] = Query(None),
    listing_type: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    bedrooms: Optional[int] = Query(None),
    bathrooms: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all properties with optional filters"""
    return property.get_all_properties(
        db, skip, limit, city, state, property_type, listing_type,
        min_price, max_price, bedrooms, bathrooms
    )




@router.get("/{property_id}", response_model=PropertyDisplay)
def get_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to get a specific property by ID"""
    return property.get_property_by_id(db, property_id)


@router.put("/{property_id}/update", response_model=PropertyDisplay)
def update_property(property_id: int, request: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to update a property"""
    return property.update_property(db, property_id, request, current_user.id)


@router.delete("/{property_id}/delete")
def delete_property(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to delete a property"""
    return property.delete_property(db, property_id, current_user.id)


@router.post("/{property_id}/favorite")
def add_to_favorites(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to add a property to user's favorites"""
    return property.add_to_favorites(db, property_id, current_user.id)


@router.delete("/{property_id}/unfavorite")
def remove_from_favorites(property_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to remove a property from user's favorites"""
    return property.remove_from_favorites(db, property_id, current_user.id)


@router.get("/favorites/me", response_model=List[PropertyListDisplay])
def get_user_favorites(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Endpoint to get all favorite properties of the current user"""
    return property.get_user_favorites(db, current_user.id, skip=skip, limit=limit)


@router.get("/agent/me", response_model=List[PropertyDisplay])
def get_agent_properties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    """Endpoint to get all properties listed by the current agent"""
    return property.get_agent_properties(db, current_user.id, skip=skip, limit=limit)


@router.post("/smart-match", response_model=List[SmartMatchProperty])
def smart_match_properties(request: SmartMatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Smart match properties based on buyer's budget.
    Returns properties within ±20% of the budget, ranked by closeness to the budget.
    """
    return property.smart_match_properties(
        db=db,
        budget=request.budget,
        user_id=current_user.id,
        property_type=request.property_type,
        listing_type=request.listing_type,
        city=request.city,
        state=request.state,
        # bedrooms=request.bedrooms,
        # bathrooms=request.bathrooms,
        limit=request.limit
    )