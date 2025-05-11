"""
Browser Use Module

This module provides browser automation functionality using Playwright.
It allows the AI to control a browser, navigate web pages, and extract information.
"""

import os
import asyncio
import logging
import base64
import re
import time
import json
from typing import Dict, List, Any, Optional, Tuple
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory for screenshots
SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

class BrowserUseManager:
    """Manages browser operations for the AI assistant"""

    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self._lock = asyncio.Lock()
        self.active_tabs = {}
        self.current_tab_id = None

    async def initialize(self):
        """Initialize the browser manager"""
        if self.playwright is None:
            logger.info("Starting Playwright and launching browser...")
            self.playwright = await async_playwright().start()
            # Force non-headless mode with explicit executable path for better visibility
            browser_type = self.playwright.chromium
            self.browser = await browser_type.launch(
                headless=False,  # MUST be False to see the browser
                args=[
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials',
                    '--disable-features=BlockInsecurePrivateNetworkRequests',
                    '--disable-blink-features=AutomationControlled',
                    '--start-maximized',  # Start with maximized window
                    '--no-sandbox',  # Add this for compatibility
                    '--disable-setuid-sandbox',  # Add this for compatibility
                ],
                slow_mo=200,  # Increase delay for better visibility
                ignore_default_args=["--mute-audio"]  # Allow audio for better user experience
            )
            logger.info("Browser manager initialized successfully")

            # Create a new context with a larger viewport for better visibility
            self.context = await self.browser.new_context(
                viewport={'width': 1600, 'height': 900},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )

            # Create a new page
            self.page = await self.context.new_page()

            # Store the first tab
            tab_id = 1
            self.active_tabs[tab_id] = self.page
            self.current_tab_id = tab_id

            logger.info("First browser tab created")

    async def close(self):
        """Close the browser manager"""
        async with self._lock:
            if self.context:
                await self.context.close()
                self.context = None
                self.page = None
                self.active_tabs = {}
                self.current_tab_id = None

            if self.browser:
                await self.browser.close()
                self.browser = None

            if self.playwright:
                await self.playwright.stop()
                self.playwright = None

            logger.info("Browser manager closed")

    async def go_to_url(self, url: str) -> Dict[str, Any]:
        """
        Navigate to a URL

        Args:
            url: The URL to navigate to

        Returns:
            Dict with the result of the navigation
        """
        await self.initialize()

        async with self._lock:
            try:
                # Validate URL
                if not url.startswith(('http://', 'https://')):
                    url = 'https://' + url

                logger.info(f"Navigating to URL: {url}")

                # Get the current page
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    # Create a new page if none exists
                    logger.info("Creating new browser page")
                    page = await self.context.new_page()
                    self.active_tabs[self.current_tab_id] = page

                # Navigate to the URL
                logger.info(f"Browser navigating to: {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Wait for the page to be fully loaded
                logger.info("Waiting for page to be fully loaded...")
                await page.wait_for_load_state("networkidle", timeout=10000)

                # Ensure the browser window is in focus
                await page.bring_to_front()

                # Add a small delay to keep the page visible
                await asyncio.sleep(1)

                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")
                await page.screenshot(path=screenshot_path)

                # Get page title
                title = await page.title()

                # Get page content
                content = await page.content()

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "url": url,
                    "title": title,
                    "content": content[:10000],  # Limit content size
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error navigating to URL {url}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def click_element(self, index: int) -> Dict[str, Any]:
        """
        Click an element on the page

        Args:
            index: The index of the element to click

        Returns:
            Dict with the result of the click
        """
        await self.initialize()

        async with self._lock:
            try:
                # Get the current page
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    return {
                        "success": False,
                        "error": "No active page"
                    }

                # Get all clickable elements
                elements = await page.query_selector_all('a, button, input[type="submit"], input[type="button"], [role="button"], [onclick]')

                if index < 0 or index >= len(elements):
                    return {
                        "success": False,
                        "error": f"Element index {index} out of range (0-{len(elements)-1})"
                    }

                # Get the element at the specified index
                element = elements[index]

                # Click the element
                await element.click()

                # Wait for navigation or network idle
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except:
                    # If timeout, it's okay, the page might not navigate
                    pass

                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")
                await page.screenshot(path=screenshot_path)

                # Get page title
                title = await page.title()

                # Get page URL
                url = page.url

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "message": f"Clicked element at index {index}",
                    "url": url,
                    "title": title,
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error clicking element at index {index}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def input_text(self, index: int, text: str) -> Dict[str, Any]:
        """
        Input text into an element

        Args:
            index: The index of the element to input text into
            text: The text to input

        Returns:
            Dict with the result of the input
        """
        await self.initialize()

        async with self._lock:
            try:
                # Get the current page
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    return {
                        "success": False,
                        "error": "No active page"
                    }

                # Get all input elements
                elements = await page.query_selector_all('input[type="text"], input[type="search"], input[type="email"], input[type="password"], input:not([type]), textarea')

                if index < 0 or index >= len(elements):
                    return {
                        "success": False,
                        "error": f"Element index {index} out of range (0-{len(elements)-1})"
                    }

                # Get the element at the specified index
                element = elements[index]

                # Clear the input field
                await element.fill("")

                # Input the text
                await element.type(text, delay=50)

                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")
                await page.screenshot(path=screenshot_path)

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "message": f"Input text '{text}' into element at index {index}",
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error inputting text into element at index {index}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def scroll(self, direction: str, amount: int = 500) -> Dict[str, Any]:
        """
        Scroll the page

        Args:
            direction: The direction to scroll ('up' or 'down')
            amount: The amount to scroll in pixels

        Returns:
            Dict with the result of the scroll
        """
        await self.initialize()

        async with self._lock:
            try:
                # Get the current page
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    return {
                        "success": False,
                        "error": "No active page"
                    }

                # Determine the scroll direction
                scroll_amount = amount if direction == 'down' else -amount

                # Scroll the page
                await page.evaluate(f"window.scrollBy(0, {scroll_amount})")

                # Wait a moment for the scroll to complete
                await asyncio.sleep(0.5)

                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")
                await page.screenshot(path=screenshot_path)

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "message": f"Scrolled {direction} by {amount} pixels",
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error scrolling {direction}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def extract_content(self, goal: str) -> Dict[str, Any]:
        """
        Extract content from the page based on a goal

        Args:
            goal: The extraction goal

        Returns:
            Dict with the extracted content
        """
        await self.initialize()

        async with self._lock:
            try:
                # Get the current page
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    return {
                        "success": False,
                        "error": "No active page"
                    }

                # Get page content
                content = await page.content()

                # Get page title
                title = await page.title()

                # Get page URL
                url = page.url

                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{timestamp}.png")
                await page.screenshot(path=screenshot_path)

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "goal": goal,
                    "url": url,
                    "title": title,
                    "content": content[:50000],  # Limit content size
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error extracting content: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def search(self, query: str) -> Dict[str, Any]:
        """
        Perform a web search

        Args:
            query: The search query

        Returns:
            Dict with the search results
        """
        await self.initialize()

        async with self._lock:
            try:
                # Navigate to Google
                page = self.active_tabs.get(self.current_tab_id)
                if not page:
                    # Create a new page if none exists
                    page = await self.context.new_page()
                    self.active_tabs[self.current_tab_id] = page

                # Navigate to Google
                logger.info("Navigating to Google search page...")
                await page.goto("https://www.google.com/", wait_until="domcontentloaded", timeout=30000)

                # Ensure the browser window is in focus
                await page.bring_to_front()

                # Accept cookies if the dialog appears
                try:
                    logger.info("Checking for cookie consent dialog...")
                    accept_button = page.locator('button:has-text("Accept all")')
                    if await accept_button.count() > 0:
                        logger.info("Cookie consent dialog found, accepting...")
                        await accept_button.click()
                        # Wait a moment for the dialog to disappear
                        await asyncio.sleep(1)
                except Exception as e:
                    logger.info(f"No cookie dialog or error handling it: {str(e)}")

                # Type the search query
                logger.info(f"Typing search query: {query}")
                await page.fill('input[name="q"]', query)

                # Add a small delay for visibility
                await asyncio.sleep(0.5)

                # Submit the search
                logger.info("Submitting search query...")
                await page.press('input[name="q"]', 'Enter')

                # Wait for results to load
                logger.info("Waiting for search results to load...")
                await page.wait_for_load_state("networkidle", timeout=10000)

                # Wait for search results to be visible
                try:
                    logger.info("Waiting for search results to be visible...")
                    await page.wait_for_selector('#search', timeout=5000)
                    logger.info("Search results are now visible")
                except Exception as e:
                    logger.warning(f"Could not find search results selector: {str(e)}")

                # Add a delay to ensure the page is visible
                await asyncio.sleep(2)

                # Take a screenshot
                logger.info("Taking screenshot of search results...")
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"search_{timestamp}.png")
                await page.screenshot(path=screenshot_path, full_page=True)

                # Get page title
                title = await page.title()

                # Get page URL
                url = page.url

                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')

                return {
                    "success": True,
                    "query": query,
                    "url": url,
                    "title": title,
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }

            except Exception as e:
                logger.error(f"Error performing search for query {query}: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

# Create a singleton instance
browser_use_manager = BrowserUseManager()
