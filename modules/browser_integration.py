"""
Browser Integration Module for AI Assistant

This module provides integration between the AI assistant and a real browser
using Playwright. It allows the AI to browse the web, take screenshots,
and interact with web pages.
"""

import os
import asyncio
import logging
import base64
import json
import uuid
from typing import Dict, Any, Optional, List
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory for screenshots
SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

class BrowserManager:
    """Manages browser instances for the AI assistant"""

    def __init__(self):
        self.active_browsers: Dict[str, Dict[str, Any]] = {}
        self.playwright = None
        self.browser = None
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Initialize the browser manager"""
        if self.playwright is None:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=False,  # Set to True for production
                args=[
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials',
                    '--disable-features=BlockInsecurePrivateNetworkRequests',
                    '--disable-blink-features=AutomationControlled',
                ]
            )
            logger.info("Browser manager initialized")

    async def close(self):
        """Close all browser instances"""
        if self.browser:
            for browser_id in list(self.active_browsers.keys()):
                await self.close_browser(browser_id)

            await self.browser.close()
            self.browser = None

        if self.playwright:
            await self.playwright.stop()
            self.playwright = None

        logger.info("Browser manager closed")

    async def open_browser(self, url: str) -> Dict[str, Any]:
        """Open a new browser and navigate to the specified URL"""
        await self.initialize()

        async with self._lock:
            # Create a new browser context
            context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )

            # Create a new page
            page = await context.new_page()

            # Generate a unique browser ID
            browser_id = str(uuid.uuid4())

            try:
                # Validate URL
                if not url.startswith(('http://', 'https://')):
                    url = 'https://' + url

                logger.info(f"Opening browser for URL: {url}")

                # Navigate to the URL
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Wait for the page to be fully loaded
                await page.wait_for_load_state("networkidle", timeout=10000)

                # Take a screenshot
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"{browser_id}.png")
                await page.screenshot(path=screenshot_path)

                # Get page title
                title = await page.title()

                # Get page content
                content = await page.content()

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                # Store the browser session
                self.active_browsers[browser_id] = {
                    'context': context,
                    'page': page,
                    'url': url,
                    'created_at': asyncio.get_event_loop().time(),
                    'last_activity': asyncio.get_event_loop().time(),
                    'screenshot_path': screenshot_path
                }

                logger.info(f"Successfully opened browser for {url} with ID {browser_id}")

                return {
                    "browser_id": browser_id,
                    "title": title,
                    "url": url,
                    "content": content[:10000],  # Limit content size
                    "screenshot": screenshot_base64
                }

            except Exception as e:
                # Clean up on error
                await context.close()
                logger.error(f"Error opening browser: {str(e)}")
                raise

    async def navigate(self, browser_id: str, url: str) -> Dict[str, Any]:
        """Navigate to a new URL in an existing browser"""
        await self.initialize()

        async with self._lock:
            browser = self.active_browsers.get(browser_id)
            if not browser:
                raise ValueError(f"Browser with ID {browser_id} not found")

            page = browser['page']

            try:
                # Navigate to the URL
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Wait for the page to be fully loaded
                await page.wait_for_load_state("networkidle", timeout=10000)

                # Take a screenshot
                screenshot_path = browser['screenshot_path']
                await page.screenshot(path=screenshot_path)

                # Get page title
                title = await page.title()

                # Get page content
                content = await page.content()

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                # Update browser session
                browser['url'] = url
                browser['last_activity'] = asyncio.get_event_loop().time()

                return {
                    "browser_id": browser_id,
                    "title": title,
                    "url": url,
                    "content": content[:10000],  # Limit content size
                    "screenshot": screenshot_base64
                }

            except Exception as e:
                logger.error(f"Error navigating browser: {str(e)}")
                raise

    async def close_browser(self, browser_id: str) -> bool:
        """Close a browser instance"""
        async with self._lock:
            browser = self.active_browsers.get(browser_id)
            if not browser:
                return False

            try:
                # Close the browser context
                await browser['context'].close()

                # Remove from active browsers
                del self.active_browsers[browser_id]

                return True
            except Exception as e:
                logger.error(f"Error closing browser: {str(e)}")
                return False

    async def list_browsers(self) -> List[Dict[str, Any]]:
        """List all active browsers"""
        browser_list = []

        for browser_id, browser in self.active_browsers.items():
            browser_list.append({
                "browser_id": browser_id,
                "url": browser['url'],
                "created_at": browser['created_at'],
                "last_activity": browser['last_activity']
            })

        return browser_list

# Create a singleton instance
browser_manager = BrowserManager()
