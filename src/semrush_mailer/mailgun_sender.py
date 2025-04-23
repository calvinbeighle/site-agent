import os
import logging
import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
SENDER_NAME = os.getenv("SENDER_NAME", "Calvin Beighle")
SENDER_TITLE = os.getenv("SENDER_TITLE", "Growth Consultant")
SENDER_COMPANY = os.getenv("SENDER_COMPANY", "Angus Design")
SENDER_EMAIL = "calvinbeighle@college.harvard.edu"  # Authorized sender email

def get_mailgun_domain():
    """Get the Mailgun domain, fetching sandbox domain if needed"""
    if not MAILGUN_API_KEY:
        logger.error("Mailgun API key not found in environment variables")
        return None
        
    try:
        # Try to get list of domains
        url = "https://api.mailgun.net/v3/domains"
        auth = ("api", MAILGUN_API_KEY)
        response = requests.get(url, auth=auth)
        response.raise_for_status()
        
        domains = response.json().get('items', [])
        
        # Look for sandbox domain
        for domain in domains:
            if 'sandbox' in domain['name']:
                logger.info(f"Found sandbox domain: {domain['name']}")
                return domain['name']
                
        logger.warning("No sandbox domain found, using default")
        return MAILGUN_DOMAIN
        
    except Exception as e:
        logger.error(f"Error fetching Mailgun domains: {e}")
        return MAILGUN_DOMAIN

def send_email(to_email, subject, body_html):
    """
    Send an email using Mailgun API
    
    Args:
        to_email (str): Recipient's email address
        subject (str): Email subject
        body_html (str): Email body in HTML format with base64 encoded image
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not MAILGUN_API_KEY or not MAILGUN_DOMAIN:
        logger.error("Mailgun credentials not found in environment variables")
        return False
    
    try:
        logger.info(f"Sending email to: {to_email}")
        
        url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
        auth = ("api", MAILGUN_API_KEY)
        
        data = {
            "from": f"{SENDER_NAME} <mailgun@{MAILGUN_DOMAIN}>",
            "to": to_email,
            "subject": subject,
            "html": body_html
        }
        
        # Log request details for debugging
        logger.debug(f"Sending request to: {url}")
        logger.debug(f"From: {data['from']}")
        logger.debug(f"To: {data['to']}")
        
        response = requests.post(url, auth=auth, data=data)
        
        # Log the response for debugging
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response text: {response.text}")
        
        response.raise_for_status()
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending email through Mailgun: {e}")
        return False

def send_emails_through_mailgun(successful_contacts):
    """
    Send emails using Mailgun API
    
    Args:
        successful_contacts (list): List of dictionaries with contact and email content info
        
    Returns:
        bool: True if emails were sent successfully, False otherwise
    """
    if not successful_contacts:
        logger.error("No contacts to send emails to")
        return False
    
    if not MAILGUN_API_KEY or not MAILGUN_DOMAIN:
        logger.error("Mailgun credentials not found in environment variables")
        return False
    
    logger.info(f"Preparing to send emails to {len(successful_contacts)} contacts through Mailgun")
    
    # Track successes and failures
    successes = 0
    failures = 0
    
    # Process each contact
    for i, contact_data in enumerate(successful_contacts, 1):
        contact = contact_data["contact"]
        email = contact.get("email", "")
        
        if not email:
            logger.warning(f"Contact {i} missing email, skipping")
            failures += 1
            continue
        
        logger.info(f"Processing contact {i}/{len(successful_contacts)}: {email}")
        
        try:
            # Use the HTML with base64 encoded image directly
            body_html = contact_data["body_html"]
            
            # Send email through Mailgun
            result = send_email(email, contact_data["subject"], body_html)
            
            if result:
                logger.info(f"Successfully sent email to: {email}")
                successes += 1
            else:
                logger.error(f"Failed to send email to: {email}")
                failures += 1
                
        except Exception as e:
            logger.error(f"Error sending email to {email}: {e}")
            failures += 1
    
    # Summary
    logger.info(f"Email sending complete. Successes: {successes}, Failures: {failures}")
    return successes > 0 