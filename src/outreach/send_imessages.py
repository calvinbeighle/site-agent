#!/usr/bin/env python3
"""
Automated iMessage sender for macOS.
Reads a Google Sheet with columns: Name, Number, Text 1, Text 2
and sends the predefined texts to each number via the Messages.app.

Requirements:
  pip3 install google-api-python-client google-auth-httplib2 google-auth-oauthlib

Before running, set the following environment variables or edit the constants:
  GOOGLE_CREDENTIALS_JSON  – path to service-account credentials JSON
  SPREADSHEET_ID           – Google Sheet ID
  SHEET_NAME               – Sheet tab name (default: Sheet1)

Run with:  python3 send_imessages.py
"""
import os
import time
import subprocess
from pathlib import Path
from typing import List

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# ---------- Configuration ---------- #
GOOGLE_CREDENTIALS_JSON = os.getenv(
    "GOOGLE_CREDENTIALS_JSON",
    "/Users/calvinbeighle/Desktop/SalesAgent/src/classification/google_credentials.json",
)
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID", "")  # <-- fill in if not using env var
SHEET_NAME = os.getenv("SHEET_NAME", "Sheet1")
SEND_DELAY = 2  # seconds between consecutive messages
# ----------------------------------- #

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def load_sheet_rows() -> List[List[str]]:
    """Fetch all rows from the Google Sheet (excluding header)."""
    creds = Credentials.from_service_account_file(GOOGLE_CREDENTIALS_JSON, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)
    rng = f"{SHEET_NAME}!A1:D"
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=rng)
        .execute()
    )
    values = result.get("values", [])
    if not values:
        print("No data found in sheet.")
        return []
    header, *rows = values
    header = [h.strip() for h in header]
    indices = {
        key: header.index(key)
        for key in ("Name", "Number", "Text 1", "Text 2")
        if key in header
    }
    processed = []
    for row in rows:
        try:
            processed.append(
                [row[indices["Name"]], row[indices["Number"]], row[indices["Text 1"]], row[indices["Text 2"]]]
            )
        except Exception:
            continue  # skip malformed rows
    return processed


def send_imessage(recipient: str, text: str):
    """Send a single message via AppleScript (iMessage)."""
    script = f'''
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "{recipient}" of targetService
        send "{text}" to targetBuddy
    end tell
    '''
    subprocess.run(["osascript", "-e", script], check=False)


def main():
    if not SPREADSHEET_ID:
        raise SystemExit("FATAL: SPREADSHEET_ID env var not set and constant left blank.")
    creds_file_exists = Path(GOOGLE_CREDENTIALS_JSON).expanduser().exists()
    if not creds_file_exists:
        raise SystemExit(f"FATAL: credentials file not found: {GOOGLE_CREDENTIALS_JSON}")

    print("DEBUG: Fetching rows from Google Sheet…")
    rows = load_sheet_rows()
    print(f"DEBUG: Loaded {len(rows)} rows")

    for name, number, text1, text2 in rows:
        print(f"DEBUG: Sending messages to {name} – {number}")
        for idx, msg in enumerate((text1, text2), 1):
            if msg:
                print(f"DEBUG:  • Text {idx}")
                send_imessage(number, msg)
                time.sleep(SEND_DELAY)
    print("DEBUG: All messages sent ✉️")


if __name__ == "__main__":
    main() 