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

# Configure Chrome options
chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--window-size=1920,1080")

# Initialize WebDriver
def get_driver():
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver
    except Exception as e:
        logger.error(f"Error initializing WebDriver: {str(e)}")
        raise

@browser_bp.route('/screenshot', methods=['POST'])
def take_screenshot():
    """Take a screenshot of a website"""
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' parameter"}), 400
        
        url = data['url']
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Initialize WebDriver
        driver = get_driver()
        
        try:
            # Navigate to URL
            driver.get(url)
            
            # Wait for page to load
            time.sleep(2)
            
            # Take screenshot
            screenshot = driver.get_screenshot_as_png()
            
            # Convert to base64
            screenshot_base64 = base64.b64encode(screenshot).decode('utf-8')
            
            # Get page title
            title = driver.title
            
            return jsonify({
                "success": True,
                "url": url,
                "title": title,
                "screenshot": screenshot_base64,
                "timestamp": time.time()
            })
        finally:
            # Close WebDriver
            driver.quit()
    except Exception as e:
        logger.error(f"Error taking screenshot: {str(e)}")
        return jsonify({"error": f"Failed to take screenshot: {str(e)}"}), 500

@browser_bp.route('/browse', methods=['POST'])
def browse_website():
    """Browse a website and extract information"""
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' parameter"}), 400
        
        url = data['url']
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Initialize WebDriver
        driver = get_driver()
        
        try:
            # Navigate to URL
            driver.get(url)
            
            # Wait for page to load
            time.sleep(2)
            
            # Take screenshot
            screenshot = driver.get_screenshot_as_png()
            screenshot_base64 = base64.b64encode(screenshot).decode('utf-8')
            
            # Get page title
            title = driver.title
            
            # Get page content
            page_source = driver.page_source
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(page_source, 'html.parser')
            
            # Extract text content
            text_content = soup.get_text()
            
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
                "text_content": text_content[:5000],  # Limit text content
                "links": links[:50],  # Limit number of links
                "meta_info": meta_info,
                "timestamp": time.time()
            })
        finally:
            # Close WebDriver
            driver.quit()
    except Exception as e:
        logger.error(f"Error browsing website: {str(e)}")
        return jsonify({"error": f"Failed to browse website: {str(e)}"}), 500
