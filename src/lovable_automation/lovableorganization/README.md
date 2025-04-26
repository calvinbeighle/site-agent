# Lovable Projects Scraper

A web scraper that extracts information from Lovable.dev projects.

## Information Extracted

For each project, the script extracts:
- Project name
- Project URL (the full URL to the Lovable project)
- Domain (extracted from the first prompt, if available)
- Number of prompts in the project

## Installation

1. Make sure you have Node.js installed
2. Clone this repository
3. Install dependencies:

```bash
cd lovableorganization
npm install
```

## Usage

**Important**: You need to be logged in to Lovable.dev in your browser before running this script. The script will access your projects.

Run the scraper with:

```bash
npm start
```

This will:
1. Check for previously processed projects in `lovable_projects.csv`
2. Open a headless browser and navigate to https://lovable.dev/projects
3. Process exactly 10 projects at a time
4. Extract the requested information from each project
5. Save the data to `lovable_projects.csv` after each batch of projects
6. Skip any projects that have already been processed (based on project name or project URL)

## Features

- **Precise filtering**: Only skips projects based on exact project name or project URL matches
- **Batch processing**: Processes exactly 10 projects at a time
- **Incremental saving**: Saves results after each batch to prevent data loss
- **Error handling**: Continues processing even if individual projects fail
- **Domain extraction**: Automatically extracts domain URLs from the first prompt text
- **Resume capability**: Can be stopped and restarted, continuing from where it left off

## Output

The script generates a CSV file with the following columns:

- Project Name
- Project URL (the full Lovable project URL)
- Domain (extracted from first prompt)
- Number of Prompts

## Requirements

- Node.js
- Internet connection
- Active Lovable.dev account 