import os
import json
import sys

# Get the directory where this script is located
current_dir = os.path.dirname(os.path.abspath(__file__))
PAGE_FILE = os.path.join(current_dir, "current_page.json")

def set_page(page_number):
    """Set the current Apollo API page number."""
    try:
        page = int(page_number)
        if page <= 0:
            print("Error: Page number must be greater than 0")
            return False
            
        # Save the page number
        with open(PAGE_FILE, 'w') as f:
            json.dump({"page": page}, f)
            
        print(f"Successfully set Apollo API pagination to page {page}")
        return True
    except ValueError:
        print("Error: Please provide a valid number")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 set_page.py <page_number>")
        sys.exit(1)
        
    success = set_page(sys.argv[1])
    if not success:
        sys.exit(1) 