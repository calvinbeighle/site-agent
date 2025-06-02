# SalesAgent

A comprehensive sales and marketing automation toolkit that includes website deployment, analysis, SEMRush reporting, automated email outreach, and CRM integration.

## Project Components

The `src` directory contains the core logic for the SalesAgent toolkit. Here's a breakdown of its main components:

### 1. Website Classification (`src/classification/`)
Handles the analysis and classification of websites using both manual review and AI-powered vision models.
- **Key Scripts**:
    - `classify_website.py`: Main script for the website classification process.
    - `screenshot_capture.py`: Captures screenshots of websites for analysis.
    - `manual_review.py`: Script to facilitate manual review of classification results.
    - `run_pipeline.sh`: A shell script to execute the classification pipeline.
- **Integration**: May integrate with Google Sheets for data input/output.
- **Data**: Stores screenshots in `screenshots/` and `screenshots_specific/`.

### 2. Lovable Automation (`src/lovable_automation/`)
Automates the creation of beautiful websites using lovable.dev through browser automation.
- **Core Components**:
    - `websitebuilder/`: Main automation engine for website creation
        - `main.js`: Core automation script for website building
        - `site_processor.js`: Handles website processing and generation
        - `privateandbadge.js`: Manages private site creation and badge generation
        - `deployment_handler.js`: Handles website deployment workflows
        - `github_handler.js`: Manages GitHub integration for deployments
    - **Templates and Prompts**:
        - Multiple prompt templates for different aspects of website generation
        - Follow-up prompts for specific elements (images, buttons, 404 pages)
    - **Testing Suite**:
        - Comprehensive test files for each component
        - Browser automation tests
        - Google Sheets integration tests
    - **Utilities**:
        - Checkpoint management for long-running processes
        - CSV processing for batch operations
        - Browser management and automation
- **Features**:
    - Automated website creation via lovable.dev
    - Batch processing of multiple sites
    - Integration with Google Sheets for data input
    - Automated deployment to GitHub
    - Comprehensive logging and error handling
    - Checkpoint system for resuming interrupted processes

### 3. Website Deployer (`src/website_deployer/`)
Handles the automated deployment of websites, primarily utilizing Vercel.
- **Key Scripts**:
    - `auto_deploy.sh`: Deploys individual projects to Vercel, including cloning repositories and DNS setup.
    - `deploy_multiple.sh`: Manages batch deployment of multiple projects, often from a CSV file.
    - `add_analytics.sh`: Adds Vercel Analytics to deployed sites and triggers redeployment.
    - `redeploy_sites.sh`: Handles the redeployment of all sites.
    - `manage_cloudflare_dns.sh`: Scripts for managing DNS records on Cloudflare.
- **Configuration**: Uses `package.json` and `vercel.json` for project-specific build and deployment settings.
- **Additional Features**: Includes scripts for scrubbing website content (`scrub_lovable.sh`, `scrub_all_sites.sh`), generating favicons, and managing deployments.

### 4. SEMRush Mailer (`src/semrush_mailer/`)
Automates the process of generating SEMRush reports and sending them via email.
- **Core Scripts**:
    - `semrush_capture.py`: Captures SEMRush report data using browser automation (likely Selenium).
    - `main.py` (or `csv_test.py` based on previous README): Main script for processing contacts from a CSV, generating reports, and sending emails.
    - `mailgun_sender.py`, `gmail_sender.py`, `apollo_sender.py`: Modules for sending emails through different providers (Mailgun, Gmail) or integrating with Apollo for sending.
    - `email_preparer.py`: Prepares email content using templates.
- **Supporting Files**:
    - `templates/`: Directory for email templates.
    - `semrush_reports/`: Stores captured SEMRush reports.
    - `email_previews/`: Stores generated email previews.
    - `requirements.txt`: Python dependencies for this component.

### 5. Outreach (`src/outreach/`)
Contains scripts for direct outreach efforts.
- `send_imessages.py`: A Python script to automate sending iMessages.

### 6. Apollo Integration (`src/apollo_integration/`)
Manages integration with Apollo.io, a sales intelligence and engagement platform.
- **Key Scripts**:
    - `apollo.py`: Core script for interacting with the Apollo API.
    - `upload.py`: Script for uploading data, potentially to Apollo.
    - `set_page.py`: Utility to handle pagination for Apollo API calls.
- **Data Files**: Uses JSON files (`seen_domains.json`, `current_page.json`, `last_run_timestamp.json`) to track API usage and state.

### 7. Data (`src/data/`)
Serves as a central location for data generated or used by the project.
- `classificationoutput/`: Directory to store output from the website classification process.

### 8. Analysis (`src/analysis/`)
Contains scripts and potentially notebooks for performing data analysis on various aspects of the project.
- **Subdirectories**:
    - `manual_review/`: Scripts or data related to analyzing manual review results.
    - `classification/`: Scripts or data for analyzing classification outputs.
    - `utilities/`: General utility scripts for analytical tasks.

### 9. Config (`src/config/`)
Holds configuration files for the project.
- `.env`: Environment variable definitions.
- `requirements.txt`: Project-wide Python dependencies.

### Other Files in `src/`
- `manual_website_review.py`: A script likely used for ad-hoc manual reviews of websites.
- `.env`: Top-level environment file, potentially duplicated or for global settings.

## Setup

1. Clone the repository:
```bash
git clone https://github.com/calvinbeighle/SearchAgent.git
cd SearchAgent
```

2. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip3 install -r requirements.txt
```

4. Configure environment variables:
Create a `.env` file with:
```
# SEMRush credentials
SEMRUSH_EMAIL=your_email
SEMRUSH_PASSWORD=your_password

# Email sender information
SENDER_NAME=Your Name
SENDER_TITLE=Your Title
SENDER_COMPANY=Your Company

# Mailgun credentials (for email sending)
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_domain

# OpenAI API Key (for classification or other AI tasks)
OPENAI_API_KEY=your_openai_key

# Apollo API Key (for sales intelligence)
APOLLO_API_KEY=your_apollo_key

# Vercel Configuration (for website_deployer)
VERCEL_ORGANIZATION=your_vercel_org_id
VERCEL_TOKEN=your_vercel_api_token

# Cloudflare Configuration (for DNS management in website_deployer)
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ZONE_ID=your_cloudflare_zone_id
CLOUDFLARE_EMAIL=your_cloudflare_email
```

## Usage

Detailed usage instructions would vary by component. Generally, you would navigate to the specific component's directory in `src/` and execute its main script or follow its dedicated README if available.

**Example - Running SEMRush Mailer (refer to `src/semrush_mailer/README.md` for specifics):**
```bash
cd src/semrush_mailer
# Activate virtual environment if not already active
# python3 main.py (or specific script like csv_test.py)
```

**Example - Deploying Websites (refer to `src/website_deployer/README_auto_deploy.md` for specifics):**
```bash
cd src/website_deployer
# ./auto_deploy.sh --url <git_repo_url> --name <project_name>
# or
# ./deploy_multiple.sh --file projects.csv
```

**Example - Classifying Websites (refer to `src/classification/README.md` for specifics):**
```bash
cd src/classification
# ./run_pipeline.sh
```

## Project Structure (Focus on `src`)
```
SalesAgent/
├── src/
│   ├── website_deployer/   # Automated website deployment (Vercel, Cloudflare)
│   │   ├── deployments/
│   │   └── ... (various .sh scripts, config files)
│   ├── semrush_mailer/       # SEMRush report automation and emailing
│   │   ├── templates/
│   │   ├── semrush_reports/
│   │   └── ...
│   ├── lovable_automation/   # Automation scripts (potentially for "Lovable" project)
│   │   ├── websitebuilder/
│   │   └── ...
│   ├── classification/       # Website analysis and classification
│   │   ├── screenshots/
│   │   └── ...
│   ├── outreach/             # Direct outreach scripts (e.g., iMessage)
│   ├── apollo_integration/   # Apollo.io integration
│   ├── data/                 # Data storage (e.g., classification output)
│   │   └── classificationoutput/
│   ├── analysis/             # Data analysis scripts and notebooks
│   │   ├── manual_review/
│   │   └── classification/
│   ├── config/               # Project configuration files
│   └── ... (other scripts like manual_website_review.py)
├── ... (other top-level files and directories like .git, venv, etc.)
```

## Features

- **Automated Website Deployment**: Streamlined deployment to Vercel with Cloudflare DNS management.
- **Automated SEMRush Reports**: Captures and processes SEMRush data.
- **Email Integration**: Supports multiple email providers for outreach and reporting.
- **Sales Intelligence Integration**: Leverages Apollo.io for contact and company data.
- **Website Analysis & Classification**: AI-powered (potentially GPT) website analysis and categorization.
- **Customizable Email Templates**: Flexible templating for email campaigns.
- **Batch Processing**: Efficiently handles multiple contacts, projects, or websites.
- **Modular Design**: Components are organized into specific directories within `src/`.

## Dependencies

- Python 3.7+
- Selenium WebDriver
- Chrome/Chromium browser
- Required Python packages in `requirements.txt`

## Notes

- Generated reports are saved in `semrush_reports/`
- Email previews are stored in `email_previews/`
- Supports batch processing of contacts
- Includes error handling and logging

## Contributing

Feel free to submit issues and enhancement requests.

## Contact

Calvin Beighle - calvin@angusdesign.com
