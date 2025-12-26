from fastapi import FastAPI
from app.database import Base, engine
from app.routers import user, property, admin, chat, visits
from app.auth.models import User, AgentProfile, ActivityLog
from app.property.models import UserProperty, PropertyImage, Favorite
from app.chat.models import Conversation, Message, Notification
from fastapi.middleware.cors import CORSMiddleware



Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Real Estate API",
    description="A comprehensive real estate management system",
    version="1.0.0"
)

origins = [
    'http://localhost:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'https://mypropertyhub.vercel.app'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins = origins,
    allow_credentials = True,
    allow_methods = ['*'],
    allow_headers = ['*']
)

app.include_router(user.router)
app.include_router(property.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(visits.router)

@app.get("/")
def read_root():
    return {
        'message': 'Welcome to the Real Estate API',
        'version': '1.0.0',
        'docs': '/docs',
        'redoc': '/redoc'
    }
