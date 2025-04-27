#!/bin/bash

# Navigate to the directory
cd "$(dirname "$0")"

# Run the test script
node test_privateandbadge.js

# Ask to clean up after running
read -p "Would you like to remove the test script? (y/n): " cleanup
if [[ $cleanup == "y" || $cleanup == "Y" ]]; then
  echo "Removing test script..."
  rm test_privateandbadge.js
  rm run_privateandbadge_test.sh
  echo "Test scripts removed."
else
  echo "Test scripts kept for future use."
fi 