# Google Sheets Integration for SalesAgent

This document explains how to set up and use the Google Sheets integration for the Sales Agent website builder.

## Setup Instructions

### 1. Create a Google Cloud Project and Enable the Google Sheets API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Google Sheets API" and enable it for your project

### 2. Create a Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name and description for your service account
4. Grant the service account the "Editor" role for the project
5. Complete the creation process
6. After creation, click on the service account email
7. Go to the "Keys" tab and click "Add Key" > "Create new key"
8. Choose JSON as the key type and download the key file

### 3. Share the Google Sheet with the Service Account

1. Open the Google Sheet: [https://docs.google.com/spreadsheets/d/1VufSCUXoQ6RTNV-BF2xYc3vx0K2d67paid2Cq7ha07M/edit#gid=0](https://docs.google.com/spreadsheets/d/1VufSCUXoQ6RTNV-BF2xYc3vx0K2d67paid2Cq7ha07M/edit#gid=0)
2. Click the "Share" button
3. Add the service account email (it will look like `service-account-name@project-id.iam.gserviceaccount.com`)
4. Give the service account "Editor" access
5. Click "Share"

### 4. Set up Environment Variable

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the location of your downloaded service account key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
```

For persistent setup, add this to your `.bashrc`, `.zshrc`, or equivalent shell configuration file.

## Sheet Structure Requirements

Ensure your Google Sheet has the following columns:

1. `Website` - The URL of the website to process
2. `Company Name` - The name of the company
3. `Industry` - The industry of the company
4. `Classification` - Set to `1` for websites that should be processed
5. `Site Build Status` - Should be empty for websites that need processing
6. `Automation Log` - Will be filled with processing results

## Running the Application

Once set up, you can run the application as usual and it will automatically read from and write to the Google Sheet instead of CSV files.

```bash
node src/lovable_automation/websitebuilder/main.js
```

## Troubleshooting

If you encounter any issues:

1. Ensure the service account has the correct permissions
2. Verify the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set correctly
3. Check that the sheet has the required columns
4. Ensure there are rows with `Classification` set to `1` and empty `Site Build Status`

For API quota issues, you may need to increase your project's quota in the Google Cloud Console. 