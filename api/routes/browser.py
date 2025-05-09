import os
import logging
import base64
import tempfile
import time
from flask import Blueprint, request, jsonify
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# Set up logging
logger = logging.getLogger(__name__)

# Create blueprint
browser_bp = Blueprint('browser', __name__)

# Configure Chrome options for real browser usage
chrome_options = Options()
# Use non-headless mode to show the actual browser window
# chrome_options.add_argument("--headless")  # Commented out to show the browser
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--start-maximized")

# Define the path for saving screenshots
SCREENSHOTS_DIR = os.path.join(os.path.expanduser('~'), 'workspace/ai_workspace/screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Initialize WebDriver with real Chromium browser
def get_driver():
    try:
        # Try to use the system's Chromium browser
        try:
            # First try to find chromium-browser
            service = Service("chromium-browser")
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("Using system chromium-browser")
            return driver
        except:
            try:
                # Then try to find chromium
                service = Service("chromium")
                driver = webdriver.Chrome(service=service, options=chrome_options)
                logger.info("Using system chromium")
                return driver
            except:
                # Fall back to Chrome
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
                logger.info("Using Chrome with ChromeDriverManager")
                return driver
    except Exception as e:
        logger.error(f"Error initializing WebDriver: {str(e)}")
        raise

@browser_bp.route('/screenshot', methods=['POST'])
def take_screenshot():
    """Take a screenshot of a website and save it to the filesystem"""
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' parameter"}), 400

        url = data['url']

        # Validate URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Generate a filename based on the URL and timestamp
        timestamp = int(time.time())
        safe_url = ''.join(c if c.isalnum() else '_' for c in url.replace('https://', '').replace('http://', ''))
        filename = f"{safe_url}_{timestamp}.png"
        filepath = os.path.join(SCREENSHOTS_DIR, filename)

        logger.info(f"Taking screenshot of {url} and saving to {filepath}")

        # Initialize WebDriver with visible browser
        driver = get_driver()

        try:
            # Navigate to URL
            driver.get(url)

            # Wait for page to load - longer wait for better rendering
            time.sleep(5)

            # Take screenshot
            screenshot = driver.get_screenshot_as_png()

            # Save screenshot to file
            with open(filepath, 'wb') as f:
                f.write(screenshot)

            # Convert to base64 for response
            screenshot_base64 = base64.b64encode(screenshot).decode('utf-8')

            # Get page title
            title = driver.title

            return jsonify({
                "success": True,
                "url": url,
                "title": title,
                "screenshot": screenshot_base64,
                "filepath": filepath,
                "timestamp": timestamp
            })
        finally:
            # Close WebDriver
            driver.quit()
    except Exception as e:
        logger.error(f"Error taking screenshot: {str(e)}")
        return jsonify({"error": f"Failed to take screenshot: {str(e)}"}), 500

@browser_bp.route('/browse', methods=['POST'])
def browse_website():
    """Browse a website and extract information, saving content to the filesystem"""
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' parameter"}), 400

        url = data['url']

        # Validate URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Generate filenames based on the URL and timestamp
        timestamp = int(time.time())
        safe_url = ''.join(c if c.isalnum() else '_' for c in url.replace('https://', '').replace('http://', ''))
        screenshot_filename = f"{safe_url}_{timestamp}.png"
        html_filename = f"{safe_url}_{timestamp}.html"
        text_filename = f"{safe_url}_{timestamp}.txt"

        screenshot_filepath = os.path.join(SCREENSHOTS_DIR, screenshot_filename)
        html_filepath = os.path.join(SCREENSHOTS_DIR, html_filename)
        text_filepath = os.path.join(SCREENSHOTS_DIR, text_filename)

        logger.info(f"Browsing {url} and saving content to {SCREENSHOTS_DIR}")

        # Initialize WebDriver with visible browser
        driver = get_driver()

        try:
            # Navigate to URL
            driver.get(url)

            # Wait for page to load - longer wait for better rendering
            time.sleep(5)

            # Take screenshot
            screenshot = driver.get_screenshot_as_png()

            # Save screenshot to file
            with open(screenshot_filepath, 'wb') as f:
                f.write(screenshot)

            # Convert to base64 for response
            screenshot_base64 = base64.b64encode(screenshot).decode('utf-8')

            # Get page title
            title = driver.title

            # Get page content
            page_source = driver.page_source

            # Save HTML content to file
            with open(html_filepath, 'w', encoding='utf-8') as f:
                f.write(page_source)

            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(page_source, 'html.parser')

            # Extract text content
            text_content = soup.get_text()

            # Save text content to file
            with open(text_filepath, 'w', encoding='utf-8') as f:
                f.write(text_content)

            # Extract links
            links = []
            for link in soup.find_all('a', href=True):
                href = link['href']
                if href.startswith('/'):
                    # Convert relative URLs to absolute
                    href = url + href if url.endswith('/') else url + '/' + href
                links.append({
                    "text": link.get_text().strip(),
                    "href": href
                })

            # Extract meta information
            meta_info = {}
            for meta in soup.find_all('meta'):
                if meta.get('name') and meta.get('content'):
                    meta_info[meta['name']] = meta['content']

            return jsonify({
                "success": True,
                "url": url,
                "title": title,
                "screenshot": screenshot_base64,
                "screenshot_path": screenshot_filepath,
                "html_path": html_filepath,
                "text_path": text_filepath,
                "text_content": text_content[:5000],  # Limit text content for response
                "links": links[:50],  # Limit number of links for response
                "meta_info": meta_info,
                "timestamp": timestamp
            })
        finally:
            # Close WebDriver
            driver.quit()
    except Exception as e:
        logger.error(f"Error browsing website: {str(e)}")
        return jsonify({"error": f"Failed to browse website: {str(e)}"}), 500
