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
