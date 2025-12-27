from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import user


from app.database import get_db
from app.auth.schemas import UserBase, UserDisplay, UserLogin, Token, RefreshTokenRequest
from app.auth.oauth2 import create_access_token, decode_refresh_token, generate_refresh_token, get_current_user
from app.auth.models import User


router = APIRouter(
    prefix='/auth',
    tags=['user']
)

@router.post("/register", response_model=UserDisplay)
async def create_user(request: UserBase, db: Session = Depends(get_db)):
    return await user.create_user(db, request)


@router.post("/login", response_model=Token)
def login(request: UserLogin, db: Session = Depends(get_db)):
    return user.login_user(db, request.username, request.password)


@router.post("/refresh", response_model=Token)
def refresh_access_token(request: RefreshTokenRequest):
    """Get new access token using refresh token"""
    payload = decode_refresh_token(request.refresh_token)
    
    # Generate new tokens
    token_data = {
        "sub": payload.get("sub"),
        "user_id": payload.get("user_id"),
        "role": payload.get("role")
    }
    
    new_access_token = create_access_token(token_data)
    new_refresh_token = generate_refresh_token(token_data)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "role": payload.get("role"),
        "token_type": "bearer"
    }


@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    return await user.verify_email(token, db)


@router.get("/profile", response_model=UserDisplay)
def get_user_profile(current_user: UserBase = Depends(get_current_user), db: Session = Depends(get_db)):
    return user.user_profile(db, current_user.id)


@router.post("/resend-verification")
async def resend_verification_email(email: str, db: Session = Depends(get_db)):
    """Resend verification email"""
    user_obj = db.query(User).filter(User.email == email).first()
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_obj.is_verified:
        return {"message": "Email already verified"}
    
    try:
        await user.send_verification_email(user_obj.email, user_obj.id)
        return {"message": "Verification email sent"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )