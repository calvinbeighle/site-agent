import os
import csv
import sys
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import time
import base64
from io import BytesIO
from PIL import Image
import threading
from queue import Queue
import requests
from urllib.parse import urlparse

app = Flask(__name__)

# Global variables
output_filename = None
csv_filename = None
preview_queue = Queue()
preview_results = {}

# List of proxy services (you can add more)
PROXY_SERVICES = [
    "https://cors-anywhere.herokuapp.com/",
    "https://api.allorigins.win/raw?url=",
    "https://api.codetabs.com/v1/proxy?quest="
]

def get_proxy_url(url):
    """Get a proxied version of the URL using available proxy services"""
    for proxy in PROXY_SERVICES:
        try:
            # Test the proxy
            test_url = f"{proxy}{url}"
            response = requests.get(test_url, timeout=5)
            if response.status_code == 200:
                return test_url
        except:
            continue
    return url  # Return original URL if no proxy works

def setup_driver():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--disable-web-security')
    chrome_options.add_argument('--disable-features=IsolateOrigins,site-per-process')
    return webdriver.Chrome(options=chrome_options)

def capture_full_page(driver):
    """Capture the full page including scrolled content"""
    # Get the total height of the page
    total_height = driver.execute_script("return document.body.scrollHeight")
    
    # Set viewport size
    driver.set_window_size(1920, total_height)
    
    # Take screenshot
    screenshot = driver.get_screenshot_as_png()
    
    # Reset viewport size
    driver.set_window_size(1920, 1080)
    
    return screenshot

def check_website_preview(url):
    try:
        driver = setup_driver()
        
        # Try direct loading first
        try:
            driver.get(url)
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            # Take screenshot anyway in case iframe fails
            screenshot = capture_full_page(driver)
            screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
            
            # More permissive iframe check - if we can load the page, we'll try iframe
            preview_results[url] = {
                'can_load_in_iframe': True,
                'screenshot': screenshot_b64,  # Keep screenshot as backup
                'proxy_url': url
            }
            
        except Exception as direct_error:
            print(f"Direct load failed for {url}: {direct_error}")
            # Try with proxy
            try:
                proxy_url = get_proxy_url(url)
                if proxy_url != url:  # Only if we got a different proxy URL
                    driver.get(proxy_url)
                    WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.TAG_NAME, "body"))
                    )
                    screenshot = capture_full_page(driver)
                    preview_results[url] = {
                        'can_load_in_iframe': True,
                        'screenshot': base64.b64encode(screenshot).decode('utf-8'),
                        'proxy_url': proxy_url
                    }
                else:
                    raise Exception("No working proxy found")
            except Exception as proxy_error:
                print(f"Proxy load failed for {url}: {proxy_error}")
                preview_results[url] = {
                    'can_load_in_iframe': False,
                    'screenshot': None,
                    'proxy_url': url
                }
        
        if driver:
            driver.quit()
            
    except Exception as e:
        print(f"Complete failure for {url}: {e}")
        if driver:
            driver.quit()
        preview_results[url] = {
            'can_load_in_iframe': False,
            'screenshot': None,
            'proxy_url': url
        }

def preview_worker():
    while True:
        url = preview_queue.get()
        if url is None:
            break
        check_website_preview(url)
        preview_queue.task_done()

def get_websites_from_csv(csv_file, num_websites):
    global csv_filename
    csv_filename = csv_file
    websites = []
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if len(websites) >= num_websites:
                    break
                if row.get('Website') and row['Website'].startswith('http'):
                    websites.append(row)
    except Exception as e:
        print(f"Error reading CSV: {e}")
    return websites

def save_approved_website(website_data):
    global output_filename
    
    # Create output filename only once
    if output_filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"website_classification_MANUAL_{timestamp}.csv"
    
    try:
        file_exists = os.path.exists(output_filename)
        
        # Get fieldnames from the first row of the input CSV
        with open(csv_filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
        
        with open(output_filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            writer.writerow(website_data)
        return True
    except Exception as e:
        print(f"Error saving to CSV: {e}")
        return False

@app.route('/')
def index():
    if len(sys.argv) != 2:
        return "Usage: python3 manual_website_review.py <csv_file>"
    
    csv_file = sys.argv[1]
    websites = get_websites_from_csv(csv_file, 100)  # Get first 100 websites
    
    # Start preview worker threads
    num_threads = 5
    threads = []
    for _ in range(num_threads):
        t = threading.Thread(target=preview_worker)
        t.start()
        threads.append(t)
    
    # Queue websites for preview
    for website in websites:
        preview_queue.put(website['Website'])
    
    # Add sentinel values to stop workers
    for _ in range(num_threads):
        preview_queue.put(None)
    
    # Start a background thread to wait for previews
    def wait_for_previews():
        preview_queue.join()
        print("All previews completed")
    
    threading.Thread(target=wait_for_previews).start()
    
    return render_template('index.html', websites=websites)

@app.route('/get_preview_status')
def get_preview_status():
    return jsonify(preview_results)

@app.route('/approve_website', methods=['POST'])
def approve_website():
    website_data = request.json
    success = save_approved_website(website_data)
    return jsonify({'success': success})

if __name__ == '__main__':
    app.run(debug=True, port=5001) 