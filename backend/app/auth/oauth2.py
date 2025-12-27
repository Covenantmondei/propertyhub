from fastapi import HTTPException, Depends, status
from jose import JWTError
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
from datetime import datetime, timedelta
from jose import jwt
import os
import dotenv
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.models import User

dotenv.load_dotenv()

oauth2_schema = OAuth2PasswordBearer(tokenUrl='token')
 
SECRET_KEY = os.environ.get('SECRET_KEY')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 120
REFRESH_TOKEN_EXPIRE_DAYS = 14

 
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Debug: Print what we're encoding
    print(f"DEBUG - Creating token with payload: {to_encode}")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_refresh_token(user_data: dict, custom_expiry: Optional[timedelta] = None):
    payload = user_data.copy()
    expiration_time = datetime.utcnow() + (custom_expiry or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    payload.update({"exp": expiration_time, "token_category": "refresh"})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_verification_token(user_id: int):
  payload = {
    "user_id": user_id,
    "exp": datetime.utcnow() + timedelta(hours=1),
    "type": "email_verification"
  }
  
  return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
  return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])



def decode_refresh_token(refresh_token: str):
    """Validate and decode refresh token"""
    try:
        decoded_payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if decoded_payload.get("token_category") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token category"
            )
        
        return decoded_payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )



def get_current_user(token: str = Depends(oauth2_schema), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"DEBUG - Decoded token payload: {payload}")
        
        user_id: int = payload.get("user_id")
        
        if user_id is None:
            print("DEBUG - user_id is None")
            raise credentials_exception
        
        # Fetch the actual user from database
        user = db.query(User).filter(User.id == user_id).first()
        
        if user is None:
            raise credentials_exception
            
        return user
        
    except JWTError as e:
        print(f"DEBUG - JWT Error: {str(e)}")
        raise credentials_exception