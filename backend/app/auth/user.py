import datetime
import os
from fastapi import HTTPException, status
from sqlalchemy.orm.session import Session
from sqlalchemy.exc import IntegrityError
from jose import JWTError
from .hash import Hash
from .models import TokenBlacklist, User
from .oauth2 import create_access_token, generate_refresh_token, create_verification_token, verify_token
from .schemas import UserBase
from app.config import send_email  # Changed: Import send_email from config
from jose import jwt


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
        db.flush()
        
        try:
            await send_verification_email(new_user.email, new_user.id)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send verification email. Please try again later or contact support. Error: {str(e)}"
            )
        
        # Email sent successfully, save user
        db.commit()
        db.refresh(new_user)

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

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - PropertyHub</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                                    🏠 PropertyHub
                                </h1>
                                <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">
                                    Welcome to Your Property Journey
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">
                                    Verify Your Email Address
                                </h2>
                                
                                <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                    Thank you for signing up with PropertyHub! We're excited to have you join our community of property buyers and agents.
                                </p>
                                
                                <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                    To get started, please verify your email address by clicking the button below:
                                </p>
                                
                                <!-- Button -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" style="padding: 0 0 30px;">
                                            <a href="{verification_link}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                                Verify Email Address
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Alternative Link -->
                                <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                                    <p style="margin: 0 0 10px; color: #374151; font-size: 14px; font-weight: 600;">
                                        Button not working?
                                    </p>
                                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                                        Copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 10px 0 0; word-break: break-all;">
                                        <a href="{verification_link}" style="color: #667eea; text-decoration: none; font-size: 14px;">
                                            {verification_link}
                                        </a>
                                    </p>
                                </div>
                                
                                <!-- Info Box -->
                                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                                    <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                                        <strong>⏰ This verification link will expire in 24 hours.</strong> Please verify your email as soon as possible.
                                    </p>
                                </div>
                                
                                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                    If you didn't create an account with PropertyHub, you can safely ignore this email.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; text-align: center;">
                                    Questions? Contact us at 
                                    <a href="mailto:support@propertyhub.com" style="color: #667eea; text-decoration: none;">
                                        support@propertyhub.com
                                    </a>
                                </p>
                                <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                                    © 2025 PropertyHub. All rights reserved.
                                </p>
                                <p style="margin: 10px 0 0; text-align: center;">
                                    <a href="{link}" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">Home</a>
                                    <a href="{link}/properties.html" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">Properties</a>
                                    <a href="{link}/contact.html" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 10px;">Contact</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    # Use Brevo send_email function
    await send_email(
        to_email=email,
        subject="🏠 Verify Your PropertyHub Account",
        html_content=html_content,
        sender_name="PropertyHub"
    )

    return {"message": "Verification email sent"}


def user_profile(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user



def logout_user(db: Session, token: str):
    """
    Blacklist the token to prevent further use
    """
    try:
        # Decode token to get expiration
        payload = jwt.decode(token, os.environ.get('SECRET_KEY'), algorithms=['HS256'])
        exp_timestamp = payload.get("exp")
        
        if exp_timestamp:
            expires_at = datetime.datetime.fromtimestamp(exp_timestamp)
            
            blacklisted_token = TokenBlacklist(
                token=token,
                expires_at=expires_at
            )
            db.add(blacklisted_token)
            db.commit()
            
            return {"message": "Successfully logged out"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
            
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Logout failed: {str(e)}"
        )