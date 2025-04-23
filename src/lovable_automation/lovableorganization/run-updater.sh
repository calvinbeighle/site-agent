#!/bin/bash

# Stop any existing Chromium processes
echo "Stopping any existing Chromium processes..."
pkill -f "Chromium" || true
pkill -f "chrome" || true

# Remove the browser data directory to start fresh
echo "Removing browser data directory..."
rm -rf "./browser-data-pw"
mkdir -p "./browser-data-pw"

# Give the system a moment
echo "Waiting for system to clean up..."
sleep 2

# Run the project updater
echo "Starting project updater..."
node project-updater.js

echo "Process completed!" 