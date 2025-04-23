import os
import requests
import time
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging

load_dotenv()
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
if not APOLLO_API_KEY:
    raise ValueError("APOLLO_API_KEY environment variable is not set")

# Base URL for Apollo API endpoints
APOLLO_BASE_URL = "https://api.apollo.io/api/v1"

# Apollo List IDs
CHATGPT_MANUFACTURING_US_LIST_ID = "67a02758363e7e0021d20006"
LA_SMALL_BUSINESS_LIST_ID = "67b4bbdca0e52a00219a0e35"
US_GENERAL_LIST_ID = "67fe0171f778590019eb81e6"

# Set the current list ID and name
CURRENT_LIST_ID = US_GENERAL_LIST_ID
CURRENT_LIST_NAME = "us_general_4_15"

# Files for state persistence
LAST_RUN_FILE = os.path.join(os.path.dirname(__file__), "last_run_timestamp.json")
PAGE_FILE = os.path.join(os.path.dirname(__file__), "current_page.json")
SEEN_DOMAINS_FILE = os.path.join(os.path.dirname(__file__), "seen_domains.json")

# Disable ALL logging
logging.basicConfig(level=logging.CRITICAL)
logger = logging.getLogger(__name__)
logging.getLogger('urllib3').setLevel(logging.CRITICAL)
logging.getLogger('requests').setLevel(logging.CRITICAL)

def load_seen_domains():
    """Load the set of domains we've already processed."""
    try:
        with open(SEEN_DOMAINS_FILE, 'r') as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()

def save_seen_domains(domains):
    """Save the set of processed domains."""
    with open(SEEN_DOMAINS_FILE, 'w') as f:
        json.dump(list(domains), f)

def get_current_page():
    """Get current page number, or 1 if no previous page."""
    try:
        with open(PAGE_FILE, 'r') as f:
            data = json.load(f)
            return data.get("page", 1)
    except (FileNotFoundError, json.JSONDecodeError):
        return 1

def save_current_page(page):
    """Save current page number."""
    with open(PAGE_FILE, 'w') as f:
        json.dump({"page": page}, f)

def save_last_run(timestamp=None):
    """Save timestamp as last run time."""
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat()
    with open(LAST_RUN_FILE, 'w') as f:
        json.dump({"last_run": timestamp}, f)
    return timestamp

def get_last_run():
    """Get timestamp of last run, or 24 hours ago if no previous run."""
    try:
        with open(LAST_RUN_FILE, 'r') as f:
            data = json.load(f)
            return data.get("last_run")
    except (FileNotFoundError, json.JSONDecodeError):
        return (datetime.utcnow() - timedelta(days=1)).isoformat()

def get_organization_data(domain):
    """Get organization data including industry using the enrichment endpoint."""
    url = f"{APOLLO_BASE_URL}/organizations/enrich"
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }
    params = {"domain": domain}
    
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()
            org = data.get("organization", {})
            return org.get("industry", "")
        return ""
    except Exception:
        return ""

def extract_domain(url):
    """Extract domain from URL."""
    if not url:
        return ""
    domain = url.lower().replace("https://", "").replace("http://", "").replace("www.", "")
    domain = domain.split("/")[0]
    return domain

def fetch_contacts_page(page, per_page, last_run):
    """Fetch a single page of contacts from Apollo."""
    headers = {
        "accept": "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY
    }
    
    url = f"{APOLLO_BASE_URL}/contacts/search"
    
    payload = {
        "page": page,
        "per_page": per_page,
        "label_ids": [CURRENT_LIST_ID],
        "q_prospect_updated_at": {
            "gte": last_run
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
    data = response.json()
    contacts = data.get("contacts", [])
        return contacts, data.get("pagination", {}).get("total_entries", 0)
    except requests.RequestException:
        return [], 0

def get_contacts_from_apollo(num_contacts=15, reset_seen=False):
    """
    Retrieves a list of contacts using pagination and deduplication.
    
    :param num_contacts: Number of unique contacts to retrieve
    :param reset_seen: Whether to reset the seen domains set
    :return: List of unique contacts
    """
    seen_domains = set() if reset_seen else load_seen_domains()
    results = []
    page = get_current_page()
    last_run = get_last_run()
    last_contact_time = None
    
    print(f"Fetching contacts updated since: {last_run}")
    print(f"Starting from page: {page}")
    
    while len(results) < num_contacts:
        contacts, total = fetch_contacts_page(page, min(num_contacts * 2, 100), last_run)
        
        if not contacts:
            break
    
    for contact in contacts:
        website = contact.get("website_url")
            organization = contact.get("organization", {})
        
        if not website and organization:
            website = organization.get("website_url")
        
        if website:
            domain = extract_domain(website)
            if domain in seen_domains:
                continue
            
            seen_domains.add(domain)
            industry = get_organization_data(domain)
            
            if not industry:
                industry = organization.get("industry", "")
            
            results.append({
                "website": website,
                "company_name": organization.get("name", ""),
                "first_name": contact.get("first_name", ""),
                "last_name": contact.get("last_name", ""),
                "email": contact.get("email", ""),
                "location": ", ".join(filter(None, [
                    contact.get("city", ""),
                    contact.get("state", ""),
                    contact.get("country", "")
                ])),
                "industry": industry
            })
            
            last_contact_time = contact.get("updated_at")
            
            if len(results) >= num_contacts:
                break
            
        time.sleep(0.5)
        
        page += 1
        save_current_page(page)
        
        if len(contacts) < min(num_contacts * 2, 100):  # No more results available
            break
    
    # Update the last run time to just after the last contact we processed
    if last_contact_time:
        save_last_run(last_contact_time)
    
    # Save the updated set of seen domains
    save_seen_domains(seen_domains)
    
    print(f"Successfully processed {len(results)} unique contacts")
    return results[:num_contacts]

if __name__ == "__main__":
    contacts = get_contacts_from_apollo()
    print(f"Fetched {len(contacts)} contacts from Apollo:")
    for contact in contacts:
        print(contact)
