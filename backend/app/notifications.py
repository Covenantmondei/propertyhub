import os
from fastapi_mail import FastMail, MessageSchema
from app.config import conf
from typing import List


async def send_admin_notification_email(
    subject: str,
    body: str,
    admin_emails: List[str]
):
    """Send email notification to admins"""
    try:
        message = MessageSchema(
            subject=subject,
            recipients=admin_emails,
            body=body,
            subtype="html"
        )
        
        fm = FastMail(conf)
        await fm.send_message(message)
        return {"success": True, "message": "Notification sent"}
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return {"success": False, "error": str(e)}


async def notify_admin_new_property(property_data: dict, agent_data: dict, admin_emails: List[str]):
    """Notify admins about new property submission"""
    subject = "🏠 New Property Awaiting Approval"
    
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #3b82f6;">New Property Submission</h2>
                <p>A new property has been submitted and is awaiting your approval.</p>
                
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1f2937;">Property Details</h3>
                    <p><strong>Title:</strong> {property_data['title']}</p>
                    <p><strong>Type:</strong> {property_data['property_type'].capitalize()}</p>
                    <p><strong>Price:</strong> ${property_data['price']:,.2f}</p>
                    <p><strong>Location:</strong> {property_data['city']}, {property_data['state']}</p>
                    <p><strong>Description:</strong> {property_data['description'][:200]}...</p>
                </div>
                
                <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1f2937;">Agent Information</h3>
                    <p><strong>Name:</strong> {agent_data['first_name']} {agent_data['last_name']}</p>
                    <p><strong>Email:</strong> {agent_data['email']}</p>
                    <p><strong>Username:</strong> {agent_data['username']}</p>
                </div>
                
                <p style="margin-top: 30px;">
                    <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:5500')}/admin.html" 
                       style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Review in Admin Dashboard
                    </a>
                </p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    This is an automated notification from PropertyHub Admin System.
                </p>
            </div>
        </body>
    </html>
    """
    
    return await send_admin_notification_email(subject, body, admin_emails)


async def notify_admin_new_agent(agent_data: dict, admin_emails: List[str]):
    """Notify admins about new agent registration"""
    subject = "👤 New Agent Registration Awaiting Approval"
    
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #8b5cf6;">New Agent Registration</h2>
                <p>A new agent has registered and is awaiting your approval.</p>
                
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1f2937;">Agent Details</h3>
                    <p><strong>Name:</strong> {agent_data['first_name']} {agent_data['last_name']}</p>
                    <p><strong>Email:</strong> {agent_data['email']}</p>
                    <p><strong>Username:</strong> {agent_data['username']}</p>
                    <p><strong>Registration Date:</strong> {agent_data['created_at'].strftime('%B %d, %Y at %I:%M %p')}</p>
                </div>
                
                <p style="margin-top: 30px;">
                    <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:5500')}/admin.html" 
                       style="background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display-inline-block;">
                        Review in Admin Dashboard
                    </a>
                </p>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                    This is an automated notification from PropertyHub Admin System.
                </p>
            </div>
        </body>
    </html>
    """
    
    return await send_admin_notification_email(subject, body, admin_emails)


def get_admin_emails(db):
    """Get all admin email addresses"""
    from app.auth.models import User, UserRole
    admins = db.query(User).filter(User.role == UserRole.ADMIN.value).all()
    return [admin.email for admin in admins]