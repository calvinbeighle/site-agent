# Lovable.dev Automation

This script automates the process of generating websites on Lovable.dev using Playwright.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Lovable.dev account with an active session

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

3. Ensure you have the following files in the project directory:
- `PremiumOutreach3.28.csv` - Your input CSV file with `Industry` and `Website` columns
- `prompt_template.txt` - The prompt template with `{{INDUSTRY}}` and `{{SITE_URL}}` placeholders

## Usage

1. Make sure you're logged into Lovable.dev in your browser
2. Run the script:
```bash
npm start
```

The script will:
- Read the CSV file
- Process each row
- Generate a customized prompt
- Submit the prompt to Lovable.dev
- Log the results to `automation_log.csv`

## Configuration

You can modify the following settings in `main.js`:
- `delayBetweenPrompts`: Delay between submissions (default: 5000ms)
- `inputFile`: Name of the input CSV file
- `promptTemplate`: Name of the prompt template file
- `logFile`: Name of the log file

## Logging

The script creates an `automation_log.csv` file with the following columns:
- Timestamp
- Industry
- Website
- Status
- Error (if any)

## Notes

- The script runs in non-headless mode so you can see what's happening
- Make sure you're logged into Lovable.dev before running the script
- The script includes error handling and logging
- You may need to update the selectors in `processPrompt()` based on the actual Lovable.dev interface 