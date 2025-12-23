import os
from fastapi import HTTPException, status
from fastapi_mail import FastMail, MessageSchema
from sqlalchemy.orm.session import Session
from sqlalchemy.exc import IntegrityError
from jose import JWTError
from .hash import Hash
from .models import User
from .oauth2 import create_access_token, generate_refresh_token, create_verification_token, verify_token
from .schemas import UserBase
from app.config import conf


async def create_user(db: Session, request: UserBase):
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == request.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        new_user = User(
            email = request.email,
            first_name = request.first_name,
            last_name = request.last_name,
            username = request.username,
            password = Hash.bcrypt(request.password),
            is_verified = False,
            role = request.role
        )
        
        # Set approval status based on role
        if request.role == "agent":
            new_user.is_approved = False
            new_user.approval_status = "pending"
        else:
            new_user.is_approved = True
            new_user.approval_status = "approved"
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        await send_verification_email(new_user.email, new_user.id)

        return new_user
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )
    

def login_user(db: Session, username: str, password: str):
    # filter by username or email
    user = db.query(User).filter(User.username == username).first() or db.query(User).filter(User.email == username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Verify password
    if not Hash.verify(user.password, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Check if user is verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in"
        )
    
    # Prepare token data
    token_data = {"sub": user.username, "user_id": user.id, "role": user.role}
    
    # Generate both tokens
    access_token = create_access_token(token_data)
    refresh_token = generate_refresh_token(token_data)
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    }


async def verify_email(token: str, db: Session):
    try:
        payload = verify_token(token)
        
        if payload.get("type") != "email_verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
        
        # Get user from database
        user_obj = db.query(User).filter(User.id == user_id).first()
        if not user_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user_obj.is_verified:
            return {"message": "Email already verified"}
        
        # Update user's verification status
        user_obj.is_verified = True
        db.commit()
        
        return {"message": "Email verified successfully"}
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )


async def send_verification_email(email: str, user_id: int):
    token = create_verification_token(user_id)

    link = os.environ.get("FRONTEND_URL")
    verification_link = f"{link}/verify-email.html?token={token}"

    message = MessageSchema(
        subject="verify your email",
        recipients=[email],
        body=f"Click on the link to verify your email: {verification_link}",
        subtype="plain"
    )

    fm = FastMail(conf)
    await fm.send_message(message)

    return {"message": "Verification email sent"}


def user_profile(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user