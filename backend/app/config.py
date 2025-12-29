import httpx
import os
from fastapi_mail import ConnectionConfig

conf = ConnectionConfig(
    MAIL_USERNAME=os.environ.get("MAIL_USERNAME"),
    MAIL_PASSWORD=os.environ.get("MAIL_PASSWORD"),
    MAIL_FROM=os.environ.get("MAIL_FROM"),

    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",

    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,

    MAIL_FROM_NAME="RealEstate App",
    # TEMPLATE_FOLDER="./templates"
)


SENDER_EMAIL = os.environ.get("EMAIL_HOST_USER")
BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
BREVO_URL = "https://api.brevo.com/v3/smtp/email"

HEADERS = {
    "accept": "application/json",
    "api-key": BREVO_API_KEY,
    "content-type": "application/json",
}


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    sender_email: str = SENDER_EMAIL,
    sender_name: str = "PropertyHub",
):
    payload = {
        "sender": {
            "name": "PropertyHub",
            "email": sender_email,
        },
        "to": [
            {"email": to_email}
        ],
        "subject": subject,
        "htmlContent": html_content,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            BREVO_URL,
            headers=HEADERS,
            json=payload,
        )

    response.raise_for_status()
    return response.json()
