from re import U
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import false
from sqlalchemy.orm import Session
from typing import List, Optional
import cloudinary.uploader
import cloudinary
import os

from app.auth.models import User
from app.property.models import Favorite, PropertyImage, UserProperty
from app.property.schemas import PropertyCreate
from app.notifications import notify_admin_new_property, get_admin_emails
from app.chat.models import Conversation



cloudinary.config(
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key = os.environ.get("CLOUDINARY_API_KEY"),
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")
)


def create_property(db: Session, request: PropertyCreate, agent_id: int):
    """Create a new property"""
    user = db.query(User).filter(User.id == agent_id).first()
    if not user or user.role != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agents can create property listings"
        )
    new_property = UserProperty(
        agent_id=agent_id,
        title=request.title,
        description=request.description,
        property_type=request.property_type,
        listing_type=request.listing_type,
        price=request.price,
        bedrooms=request.bedrooms,
        bathrooms=request.bathrooms,
        area_sqft=request.area_sqft,
        address=request.address,
        city=request.city,
        state=request.state,
        zip_code=request.zip_code,
        country=request.country,
        year_built=request.year_built,
        parking_spaces=request.parking_spaces,
        amenities=request.amenities,
        is_approved=False,
        approval_status="pending",
        is_available=False
    )
    db.add(new_property)
    db.commit()
    db.refresh(new_property)

    # Send notification to admins
    try:
        admin_emails = get_admin_emails(db)
        if admin_emails:
            import asyncio
            property_dict = {
                'title': new_property.title,
                'property_type': new_property.property_type,
                'price': new_property.price,
                'city': new_property.city,
                'state': new_property.state,
                'description': new_property.description
            }
            agent_dict = {
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'username': user.username
            }
            # Run async function in sync context
            loop = asyncio.get_event_loop()
            loop.create_task(notify_admin_new_property(property_dict, agent_dict, admin_emails))
    except Exception as e:
        print(f"Failed to send admin notification: {str(e)}")
        # Don't fail the property creation if notification fails

    return new_property


def upload_property_images(db: Session, property_id: int, files: List[UploadFile], agent_id: int):
    """Upload images to Cloudinary and save URLs to database"""
    # Verify property exists and belongs to agent
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    if property.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload images to your own properties"
        )
    
    # Get agent info
    agent = db.query(User).filter(User.id == agent_id).first()
    
    uploaded_images = []
    for index, file in enumerate(files):
        try:
            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                file.file,
                folder=f"real_estate/media/properties/{property_id}"
            )
            
            # Save to database
            property_image = PropertyImage(
                property_id=property_id,
                image_url=result['secure_url'],
                public_id=result['public_id'],
                is_primary=(index == 0 and len(property.images) == 0),  # First image is primary if no images exist
                order=len(property.images) + index
            )
            db.add(property_image)
            uploaded_images.append(property_image)
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error uploading image: {str(e)}"
            )
    
    db.commit()
    
    # Refresh to get IDs
    for img in uploaded_images:
        db.refresh(img)
    
    return {
        "message": "Images uploaded successfully",
        "property_id": property.id,
        "property_title": property.title,
        "images_uploaded": len(uploaded_images),
        "images": [
            {
                "id": img.id,
                "image_url": img.image_url,
                "public_id": img.public_id,
                "is_primary": img.is_primary,
                "order": img.order,
                "property_id": img.property_id,
                "created_at": img.created_at
            }
            for img in uploaded_images
        ],
        "agent": {
            "id": agent.id,
            "username": agent.username,
            "email": agent.email,
            "first_name": agent.first_name,
            "last_name": agent.last_name
        }
    }


def get_all_properties(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    city: Optional[str] = None,
    state: Optional[str] = None,
    property_type: Optional[str] = None,
    listing_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[int] = None
):
    """Get all properties with optional filters"""
    query = db.query(UserProperty).filter(UserProperty.is_available == True)
    
    if city:
        query = query.filter(UserProperty.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(UserProperty.state.ilike(f"%{state}%"))
    if property_type:
        query = query.filter(UserProperty.property_type == property_type)
    if listing_type:
        query = query.filter(UserProperty.listing_type == listing_type)
    if min_price:
        query = query.filter(UserProperty.price >= min_price)
    if max_price:
        query = query.filter(UserProperty.price <= max_price)
    if bedrooms:
        query = query.filter(UserProperty.bedrooms >= bedrooms)
    if bathrooms:
        query = query.filter(UserProperty.bathrooms >= bathrooms)
    
    properties = query.order_by(UserProperty.created_at.desc()).offset(skip).limit(limit).all()
    
    # Add primary image to each property
    result = []
    for prop in properties:
        primary_image = db.query(PropertyImage).filter(
            PropertyImage.property_id == prop.id,
            PropertyImage.is_primary == True
        ).first()
        
        prop_dict = {
            "id": prop.id,
            "title": prop.title,
            "property_type": prop.property_type,
            "listing_type": prop.listing_type,
            "price": prop.price,
            "bedrooms": prop.bedrooms,
            "bathrooms": prop.bathrooms,
            "area_sqft": prop.area_sqft,
            "city": prop.city,
            "state": prop.state,
            "is_available": prop.is_available,
            "created_at": prop.created_at,
            "primary_image": primary_image.image_url if primary_image else None
        }
        result.append(prop_dict)
    
    return result

def get_property_by_id(db: Session, property_id: int):
    """Get a single property by ID with all images"""
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    return property



def update_property(db: Session, property_id: int, request: PropertyCreate, agent_id: int):
    """Update a property"""
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    if property.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own properties"
        )
    
    # Update fields
    for key, value in request.dict().items():
        setattr(property, key, value)
    
    db.commit()
    db.refresh(property)
    return property



def delete_property(db: Session, property_id: int, agent_id: int):
    """Delete a property"""
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    if property.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own properties"
        )
    
    conversations = db.query(Conversation).filter(Conversation.property_id == property_id).all()
    for conversation in conversations:
        db.delete(conversation)
    
    # Delete images from Cloudinary
    for image in property.images:
        if image.public_id:
            try:
                cloudinary.uploader.destroy(image.public_id)
            except:
                pass  # Continue even if Cloudinary deletion fails
    
    db.delete(property)
    db.commit()
    return {"message": "Property deleted successfully"}


def add_to_favorites(db: Session, property_id: int, user_id: int):
    """Add property to user's favorites"""
    # Check if property exists
    property = db.query(UserProperty).filter(UserProperty.id == property_id).first()
    if not property:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check if already in favorites
    existing = db.query(Favorite).filter(
        Favorite.user_id == user_id,
        Favorite.property_id == property_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property already in favorites"
        )
    
    favorite = Favorite(user_id=user_id, property_id=property_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    
    return favorite


def remove_from_favorites(db: Session, property_id: int, user_id: int):
    """Remove property from user's favorites"""
    favorite = db.query(Favorite).filter(
        Favorite.user_id == user_id,
        Favorite.property_id == property_id
    ).first()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not in favorites"
        )
    
    db.delete(favorite)
    db.commit()
    return {"message": "Removed from favorites"}


def get_user_favorites(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    """Get user's favorite properties"""
    favorites = db.query(Favorite).filter(Favorite.user_id == user_id).offset(skip).limit(limit).all()
    
    # Get full property details for each favorite
    result = []
    for fav in favorites:
        prop = db.query(UserProperty).filter(UserProperty.id == fav.property_id).first()
        if prop:
            # Get primary image
            primary_image = db.query(PropertyImage).filter(
                PropertyImage.property_id == prop.id,
                PropertyImage.is_primary == True
            ).first()
            
            prop_dict = {
                "id": prop.id,
                "title": prop.title,
                "property_type": prop.property_type,
                "listing_type": prop.listing_type,
                "price": prop.price,
                "bedrooms": prop.bedrooms,
                "bathrooms": prop.bathrooms,
                "area_sqft": prop.area_sqft,
                "city": prop.city,
                "state": prop.state,
                "is_available": prop.is_available,
                "created_at": prop.created_at,
                "primary_image": primary_image.image_url if primary_image else None
            }
            result.append(prop_dict)
    
    return result


def get_agent_properties(db: Session, agent_id: int, skip: int = 0, limit: int = 20):
    """Get all properties listed by an agent"""
    properties = db.query(UserProperty).filter(UserProperty.agent_id == agent_id).order_by(UserProperty.created_at.desc()).offset(skip).limit(limit).all()
    return properties


def smart_match_properties(
    db: Session,
    budget: float,
    user_id: int,
    property_type: Optional[str] = None,
    listing_type: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    # bedrooms: Optional[int] = None,
    # bathrooms: Optional[int] = None,
    limit: int = 20
):
    """
    Smart match properties based on buyer's budget
    Returns properties within ±20% of the budget, ranked by closeness to budget
    """
    # Calculate price range (±20% of budget)
    lower_bound = budget * 0.8
    upper_bound = budget * 1.2
    
    # Build query for available and approved properties
    query = db.query(UserProperty).filter(
        UserProperty.is_available == True,
        UserProperty.is_approved == True,
        UserProperty.price >= lower_bound,
        UserProperty.price <= upper_bound
    )
    
    # Apply optional filters
    if property_type:
        query = query.filter(UserProperty.property_type == property_type)
    if listing_type:
        query = query.filter(UserProperty.listing_type == listing_type)
    if city:
        query = query.filter(UserProperty.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(UserProperty.state.ilike(f"%{state}%"))
    
    # Get all matching properties
    properties = query.all()
    
    result = []
    for prop in properties:
        # Calculate percentage difference from budget
        price_diff = abs(prop.price - budget)
        price_diff_percentage = (price_diff / budget) * 100
        
        match_score = 100 - price_diff_percentage
        
        # Get primary image
        primary_image = db.query(PropertyImage).filter(
            PropertyImage.property_id == prop.id,
            PropertyImage.is_primary == True
        ).first()
        
        # Check if property is in user's favorites
        is_favorite = db.query(Favorite).filter(
            Favorite.user_id == user_id,
            Favorite.property_id == prop.id
        ).first() is not None
        
        prop_dict = {
            "id": prop.id,
            "title": prop.title,
            "description": prop.description,
            "property_type": prop.property_type,
            "listing_type": prop.listing_type,
            "price": prop.price,
            "bedrooms": prop.bedrooms,
            "bathrooms": prop.bathrooms,
            "area_sqft": prop.area_sqft,
            "address": prop.address,
            "city": prop.city,
            "state": prop.state,
            "zip_code": prop.zip_code,
            "country": prop.country,
            "year_built": prop.year_built,
            "parking_spaces": prop.parking_spaces,
            "amenities": prop.amenities,
            "is_available": prop.is_available,
            "created_at": prop.created_at,
            "primary_image": primary_image.image_url if primary_image else None,
            "match_score": round(match_score, 2),
            "price_difference": round(prop.price - budget, 2),
            "is_favorite": is_favorite
        }
        result.append(prop_dict)
    
    # Sort by score (highest first)
    result.sort(key=lambda x: x["match_score"], reverse=True)
    
    # Limit results
    return result[:limit]