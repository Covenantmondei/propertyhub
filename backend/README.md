# Real Estate API

A comprehensive RESTful API for managing real estate property listings, built with FastAPI, SQLAlchemy, and Cloudinary for image management. This platform enables agents to list properties, buyers to browse and search listings, and administrators to manage the platform.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Usage Examples](#usage-examples)
- [Development](#development)

## Features

### User Management
- **Multi-Role System**: Users can register as Buyers, Agents, or Admins
- **Email Verification**: Secure email verification using JWT tokens
- **Authentication**: JWT-based authentication with access and refresh tokens
- **Agent Approval**: Agent accounts require admin approval before activation
- **User Profiles**: Users can manage their profile information

### Admin Features
- **Dashboard**: Comprehensive statistics and overview
- **Agent Management**: Approve or reject agent registrations
- **Property Management**: Approve or reject property listings
- **User Management**: View, suspend, and manage all users
- **Activity Logs**: Track all admin actions and user activities
- **User Suspension**: Suspend/unsuspend users with reasons

### Property Management (Agents Only)
- **Create Listings**: Agents can create detailed property listings
- **Image Upload**: Multiple image uploads via Cloudinary integration
- **Property Status**: Properties pending admin approval before going live
- **Update/Delete**: Full CRUD operations for property management
- **Property Dashboard**: View all properties listed by the agent

### Property Discovery (All Users)
- **Browse Properties**: View all approved properties
- **Advanced Filtering**: Filter by city, state, property type, listing type, price range, bedrooms, and bathrooms
- **Property Details**: View comprehensive property information with images
- **Favorites System**: Save properties to favorites for later viewing
- **Search Functionality**: Search properties with multiple parameters

### Chat System
- **Real-Time Messaging**: WebSocket-based chat between buyers and agents
- **Conversations**: Create and manage conversations about properties
- **Notifications**: Push notifications for new messages
- **Message Status**: Read receipts and message tracking
- **Chat Statistics**: View unread messages and conversation counts

### Image Management
- **Cloudinary Integration**: Secure cloud-based image storage
- **Multiple Images**: Upload multiple images per property
- **Primary Image**: Automatic primary image assignment
- **Image Ordering**: Organized image display

## Tech Stack

- **Framework**: FastAPI 0.123.3
- **Database**: SQLite with SQLAlchemy 2.0.44 ORM
- **Authentication**: JWT (python-jose 3.5.0)
- **Password Hashing**: Passlib 1.7.4 with bcrypt
- **Image Storage**: Cloudinary 1.44.1
- **Email Service**: FastAPI-Mail 1.5.8 with SMTP
- **Validation**: Pydantic 2.12.5
- **WebSocket**: Built-in FastAPI WebSocket support
- **Server**: Uvicorn 0.38.0

## Project Structure

```
backend/
├── main.py                 # Application entry point
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── app/
│   ├── config.py          # Configuration and settings
│   ├── database.py        # Database connection and session
│   ├── notifications.py   # Push notification service
│   ├── admin/
│   │   ├── admin.py       # Admin business logic
│   │   ├── models.py      # Admin-related models
│   │   └── schemas.py     # Admin Pydantic schemas
│   ├── auth/
│   │   ├── hash.py        # Password hashing utilities
│   │   ├── models.py      # User model
│   │   ├── oauth2.py      # JWT authentication
│   │   ├── schemas.py     # User schemas
│   │   └── user.py        # User business logic
│   ├── chat/
│   │   ├── chat.py        # Chat business logic and WebSocket manager
│   │   ├── models.py      # Chat-related models
│   │   └── schemas.py     # Chat schemas
│   ├── property/
│   │   ├── models.py      # Property model
│   │   ├── property.py    # Property business logic
│   │   └── schemas.py     # Property schemas
│   └── routers/
│       ├── admin.py       # Admin endpoints
│       ├── chat.py        # Chat endpoints
│       ├── property.py    # Property endpoints
│       └── user.py        # User authentication endpoints
└── media/                 # Local media storage (if needed)
```

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)
- Cloudinary account (for image storage)
- SMTP server credentials (for email verification)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the backend directory:
```env
# Database
DATABASE_URL=sqlite:///./realestate.db

# JWT Secret Keys
SECRET_KEY=your-secret-key-here
REFRESH_SECRET_KEY=your-refresh-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Configuration
MAIL_USERNAME=your-email@example.com
MAIL_PASSWORD=your-email-password
MAIL_FROM=your-email@example.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# Application URL
URL=http://localhost:8000
```

5. Run database migrations (tables will be created automatically on first run):
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`
API documentation will be available at `http://localhost:8000/docs`

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite database path | Yes |
| `SECRET_KEY` | JWT access token secret key | Yes |
| `REFRESH_SECRET_KEY` | JWT refresh token secret key | Yes |
| `ALGORITHM` | JWT algorithm (default: HS256) | Yes |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token expiration time | Yes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token expiration time | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `MAIL_USERNAME` | SMTP username | Yes |
| `MAIL_PASSWORD` | SMTP password | Yes |
| `MAIL_FROM` | Email sender address | Yes |
| `MAIL_PORT` | SMTP port | Yes |
| `MAIL_SERVER` | SMTP server address | Yes |
| `MAIL_STARTTLS` | Enable STARTTLS | Yes |
| `MAIL_SSL_TLS` | Enable SSL/TLS | Yes |
| `URL` | Application base URL | Yes |

## Database Models

### User Model
- **id**: Integer (Primary Key)
- **username**: String (Unique)
- **email**: String (Unique)
- **password**: String (Hashed)
- **first_name**: String (Optional)
- **last_name**: String (Optional)
- **role**: String (buyer, agent, admin)
- **is_verified**: Boolean
- **is_approved**: Boolean (for agents)
- **approval_status**: String (pending, approved, rejected)
- **is_suspended**: Boolean
- **suspension_reason**: String (Optional)
- **created_at**: DateTime
- **updated_at**: DateTime

### Property Model
- **id**: Integer (Primary Key)
- **title**: String
- **description**: Text
- **property_type**: String (apartment, house, condo, townhouse, land)
- **listing_type**: String (sale, rent)
- **price**: Float
- **address**: String
- **city**: String
- **state**: String
- **zip_code**: String (Optional)
- **country**: String
- **bedrooms**: Integer (Optional)
- **bathrooms**: Integer (Optional)
- **area_sqft**: Float (Optional)
- **year_built**: Integer (Optional)
- **parking_spaces**: Integer (Optional)
- **amenities**: JSON (Optional)
- **images**: JSON (Array of image URLs)
- **is_approved**: Boolean
- **agent_id**: Integer (Foreign Key to User)
- **created_at**: DateTime
- **updated_at**: DateTime

### Conversation Model
- **id**: Integer (Primary Key)
- **property_id**: Integer (Foreign Key to Property)
- **buyer_id**: Integer (Foreign Key to User)
- **agent_id**: Integer (Foreign Key to User)
- **last_message**: Text (Optional)
- **last_message_at**: DateTime (Optional)
- **created_at**: DateTime
- **updated_at**: DateTime

### Message Model
- **id**: Integer (Primary Key)
- **conversation_id**: Integer (Foreign Key to Conversation)
- **sender_id**: Integer (Foreign Key to User)
- **content**: Text
- **is_read**: Boolean
- **read_at**: DateTime (Optional)
- **created_at**: DateTime

### Notification Model
- **id**: Integer (Primary Key)
- **user_id**: Integer (Foreign Key to User)
- **title**: String
- **body**: Text
- **conversation_id**: Integer (Foreign Key to Conversation, Optional)
- **is_read**: Boolean
- **created_at**: DateTime

### ActivityLog Model
- **id**: Integer (Primary Key)
- **admin_id**: Integer (Foreign Key to User)
- **action**: String
- **target_type**: String (user, property, agent)
- **target_id**: Integer
- **details**: Text (Optional)
- **created_at**: DateTime

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and get tokens | No |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/verify-email` | Verify email address | No |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/dashboard` | Get dashboard statistics | Admin |
| GET | `/admin/agents/pending` | Get pending agent approvals | Admin |
| POST | `/admin/agents/approve` | Approve an agent | Admin |
| POST | `/admin/agents/reject` | Reject an agent | Admin |
| GET | `/admin/properties/pending` | Get pending property approvals | Admin |
| POST | `/admin/properties/approve` | Approve a property | Admin |
| POST | `/admin/properties/reject` | Reject a property | Admin |
| GET | `/admin/users` | Get all users | Admin |
| GET | `/admin/activity-logs` | Get activity logs | Admin |
| POST | `/admin/users/suspend` | Suspend a user | Admin |
| POST | `/admin/users/{user_id}/unsuspend` | Unsuspend a user | Admin |

### Property Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/properties/create` | Create a new property | Agent |
| POST | `/properties/{id}/upload` | Upload property images | Agent |
| GET | `/properties/all` | Get all approved properties | No |
| GET | `/properties/{id}` | Get property by ID | Yes |
| PUT | `/properties/{id}/update` | Update a property | Agent (Owner) |
| DELETE | `/properties/{id}/delete` | Delete a property | Agent (Owner) |
| POST | `/properties/{id}/favorite` | Add to favorites | Yes |
| DELETE | `/properties/{id}/unfavorite` | Remove from favorites | Yes |
| GET | `/properties/favorites/me` | Get user's favorites | Yes |
| GET | `/properties/agent/me` | Get agent's properties | Agent |

### Chat Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/chat/conversations` | Create a conversation | Yes |
| GET | `/chat/conversations` | Get user's conversations | Yes |
| GET | `/chat/conversations/{id}` | Get conversation details | Yes |
| POST | `/chat/conversations/{id}/messages` | Send a message | Yes |
| GET | `/chat/notifications` | Get notifications | Yes |
| PUT | `/chat/notifications/{id}` | Mark notification as read | Yes |
| PUT | `/chat/notifications/mark-all-read` | Mark all as read | Yes |
| GET | `/chat/stats` | Get chat statistics | Yes |
| WS | `/chat/ws/{user_id}` | WebSocket connection | Yes |

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Upon successful login, you receive:

- **access_token**: Short-lived token (30 minutes) for API requests
- **refresh_token**: Long-lived token (7 days) for obtaining new access tokens

### Using Authentication

Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Refresh

When the access token expires, use the refresh token to get a new one:

```bash
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "<refresh_token>"
}
```

## Usage Examples

### Register a New User

```bash
POST /auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "role": "buyer"
}
```

### Login

```bash
POST /auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "SecurePassword123!"
}
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "buyer"
  }
}
```

### Create a Property (Agent)

```bash
POST /properties/create
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Beautiful 3BR Apartment",
  "description": "Spacious apartment in downtown",
  "property_type": "apartment",
  "listing_type": "rent",
  "price": 1500,
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "bedrooms": 3,
  "bathrooms": 2,
  "area_sqft": 1200,
  "amenities": "[\"parking\", \"gym\", \"pool\"]"
}
```

### Browse Properties with Filters

```bash
GET /properties/all?city=New+York&property_type=apartment&min_price=1000&max_price=2000&bedrooms=3
```

### Create a Conversation

```bash
POST /chat/conversations
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "property_id": 1,
  "initial_message": "I'm interested in viewing this property"
}
```

### Send a Message

```bash
POST /chat/conversations/1/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "What time is available for viewing?"
}
```

## Development

### Running the Development Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Testing

The API includes automatic data validation through Pydantic models. Test the endpoints using:

1. Swagger UI (http://localhost:8000/docs)
2. Postman or similar API testing tools
3. Frontend application

### Database Management

To reset the database:

```bash
rm realestate.db
# Restart the server to recreate tables
uvicorn main:app --reload
```

### Creating an Admin User

Admin users must be created directly in the database or through a seed script. The role field should be set to "admin" and is_approved should be True.

## Error Handling

The API uses standard HTTP status codes:

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (invalid or missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **500**: Internal Server Error

Error responses include a detail message:

```json
{
  "detail": "Error message description"
}
```

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens expire and require refresh
- Email verification required for new users
- Agent accounts require admin approval
- Admin endpoints protected with role-based access control
- User suspension functionality for moderation
- Activity logging for admin actions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software. All rights reserved.
