"""
Web Search Module for AI Assistant

This module provides web search functionality using Playwright to control Chromium.
It allows the AI to search the web and extract information from search results.
"""

import os
import asyncio
import logging
import base64
import re
import time
from typing import Dict, List, Any, Optional
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directory for screenshots
SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

class WebSearchManager:
    """Manages web search operations for the AI assistant"""
    
    def __init__(self):
        self.playwright = None
        self.browser = None
        self._lock = asyncio.Lock()
        
    async def initialize(self):
        """Initialize the web search manager"""
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
            logger.info("Web search manager initialized")
    
    async def close(self):
        """Close the web search manager"""
        if self.browser:
            await self.browser.close()
            self.browser = None
        
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
            
        logger.info("Web search manager closed")
    
    async def search_google(self, query: str) -> Dict[str, Any]:
        """
        Perform a Google search and extract results
        
        Args:
            query: The search query
            
        Returns:
            Dict with search results and screenshot
        """
        await self.initialize()
        
        async with self._lock:
            # Create a new browser context
            context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
            
            # Create a new page
            page = await context.new_page()
            
            try:
                # Navigate to Google
                await page.goto("https://www.google.com/", wait_until="domcontentloaded", timeout=30000)
                
                # Accept cookies if the dialog appears
                try:
                    accept_button = page.locator('button:has-text("Accept all")')
                    if await accept_button.count() > 0:
                        await accept_button.click()
                except Exception as e:
                    logger.info(f"No cookie dialog or error handling it: {str(e)}")
                
                # Type the search query
                await page.fill('input[name="q"]', query)
                
                # Submit the search
                await page.press('input[name="q"]', 'Enter')
                
                # Wait for results to load
                await page.wait_for_load_state("networkidle", timeout=10000)
                
                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"search_{timestamp}.png")
                await page.screenshot(path=screenshot_path)
                
                # Extract search results
                results = []
                
                # Get organic search results
                result_elements = await page.query_selector_all('div.g')
                
                for element in result_elements:
                    try:
                        # Extract title
                        title_element = await element.query_selector('h3')
                        title = await title_element.inner_text() if title_element else "No title"
                        
                        # Extract URL
                        link_element = await element.query_selector('a')
                        link = await link_element.get_attribute('href') if link_element else "#"
                        
                        # Extract snippet
                        snippet_element = await element.query_selector('div.VwiC3b')
                        snippet = await snippet_element.inner_text() if snippet_element else "No snippet"
                        
                        results.append({
                            "title": title,
                            "link": link,
                            "snippet": snippet
                        })
                    except Exception as e:
                        logger.error(f"Error extracting search result: {str(e)}")
                
                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')
                
                return {
                    "query": query,
                    "results": results[:5],  # Limit to top 5 results
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }
                
            except Exception as e:
                logger.error(f"Error performing Google search: {str(e)}")
                raise
            finally:
                # Close the context
                await context.close()
    
    async def search_duckduckgo(self, query: str) -> Dict[str, Any]:
        """
        Perform a DuckDuckGo search and extract results
        
        Args:
            query: The search query
            
        Returns:
            Dict with search results and screenshot
        """
        await self.initialize()
        
        async with self._lock:
            # Create a new browser context
            context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
            
            # Create a new page
            page = await context.new_page()
            
            try:
                # Navigate to DuckDuckGo
                await page.goto("https://duckduckgo.com/", wait_until="domcontentloaded", timeout=30000)
                
                # Type the search query
                await page.fill('input[name="q"]', query)
                
                # Submit the search
                await page.press('input[name="q"]', 'Enter')
                
                # Wait for results to load
                await page.wait_for_load_state("networkidle", timeout=10000)
                
                # Take a screenshot
                timestamp = int(time.time())
                screenshot_path = os.path.join(SCREENSHOTS_DIR, f"search_{timestamp}.png")
                await page.screenshot(path=screenshot_path)
                
                # Extract search results
                results = []
                
                # Get organic search results
                result_elements = await page.query_selector_all('article.result')
                
                for element in result_elements:
                    try:
                        # Extract title
                        title_element = await element.query_selector('h2')
                        title = await title_element.inner_text() if title_element else "No title"
                        
                        # Extract URL
                        link_element = await element.query_selector('a.result__a')
                        link = await link_element.get_attribute('href') if link_element else "#"
                        
                        # Extract snippet
                        snippet_element = await element.query_selector('div.result__snippet')
                        snippet = await snippet_element.inner_text() if snippet_element else "No snippet"
                        
                        results.append({
                            "title": title,
                            "link": link,
                            "snippet": snippet
                        })
                    except Exception as e:
                        logger.error(f"Error extracting search result: {str(e)}")
                
                # Read screenshot as base64
                with open(screenshot_path, "rb") as image_file:
                    screenshot_base64 = base64.b64encode(image_file.read()).decode('utf-8')
                
                return {
                    "query": query,
                    "results": results[:5],  # Limit to top 5 results
                    "screenshot": screenshot_base64,
                    "timestamp": timestamp
                }
                
            except Exception as e:
                logger.error(f"Error performing DuckDuckGo search: {str(e)}")
                raise
            finally:
                # Close the context
                await context.close()

# Create a singleton instance
web_search_manager = WebSearchManager()
