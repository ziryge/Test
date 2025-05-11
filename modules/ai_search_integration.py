"""
AI Search Integration Module

This module integrates the web search functionality with the AI model.
It detects search intents in AI responses and triggers web searches.
"""

import re
import logging
import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Tuple

from modules.web_search import web_search_manager
from modules.llama_integration import get_llama_response
from modules.browser_use import browser_use_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Helper function to run async functions
def run_async(coroutine):
    """Run an async function from a synchronous context"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

def detect_search_intent(text: str) -> Optional[str]:
    """
    Detect search intent in AI response

    Args:
        text: The AI response text

    Returns:
        The search query if found, None otherwise
    """
    # Pattern to match search intent
    pattern = r"<search>(.*?)</search>"
    match = re.search(pattern, text, re.DOTALL)

    if match:
        return match.group(1).strip()

    return None

def process_search_intent(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Process search intent in AI response

    Args:
        text: The AI response text

    Returns:
        Tuple[str, List[Dict[str, Any]]]: The processed text and a list of search actions
    """
    # Pattern to match search intent
    pattern = r"<search>(.*?)</search>"
    search_actions = []

    # Find all search intents
    matches = re.finditer(pattern, text, re.DOTALL)

    # If no matches, return the original text
    if not re.search(pattern, text, re.DOTALL):
        return text, search_actions

    # Process each search intent
    for match in matches:
        query = match.group(1).strip()

        if not query:
            # No query found, replace with error message
            replacement = "I tried to search, but couldn't find a valid query."
            text = text.replace(match.group(0), replacement)
            continue

        logger.info(f"Processing search intent for query: {query}")

        try:
            # Try using our browser_use_manager to perform a search
            logger.info(f"Using browser_use_manager to search for: {query}")
            search_result = run_async(browser_use_manager.search(query))

            if search_result.get("success", False):
                # Record the search action from browser_use_manager
                search_actions.append({
                    "query": query,
                    "url": search_result.get("url", ""),
                    "title": search_result.get("title", ""),
                    "timestamp": search_result.get("timestamp", time.time()),
                    "screenshot": search_result.get("screenshot", "")
                })

                # Format the search results
                result_text = []
                result_text.append(f"Search results for '{query}':")
                result_text.append(f"I used a real browser to search and found results at {search_result.get('title', 'Google Search')}")
                result_text.append(f"URL: {search_result.get('url', '')}")
                result_text.append("")
                result_text.append("Based on the search results, I can provide you with information about your query.")

                # Create the replacement text
                replacement = "I searched the web using a real browser and found the following information:\n\n" + "\n".join(result_text)
            else:
                # Fall back to web_search_manager if browser_use_manager fails
                logger.info(f"Falling back to web_search_manager for: {query}")
                search_result = run_async(web_search_manager.search_google(query))

                # Record the search action
                search_actions.append({
                    "query": query,
                    "timestamp": search_result["timestamp"]
                })

                # Format the search results
                result_text = []
                result_text.append(f"Search results for '{query}':")

                for i, result in enumerate(search_result["results"], 1):
                    result_text.append(f"{i}. {result['title']}")
                    result_text.append(f"   URL: {result['link']}")
                    result_text.append(f"   {result['snippet']}")
                    result_text.append("")

                # Create the replacement text
                replacement = "I searched the web and found the following information:\n\n" + "\n".join(result_text)

            # Replace the search intent with the results
            text = text.replace(match.group(0), replacement)

        except Exception as e:
            logger.error(f"Error processing search intent for query {query}: {str(e)}")
            replacement = f"I tried to search for '{query}', but encountered an error: {str(e)}"
            text = text.replace(match.group(0), replacement)

    return text, search_actions

def ask_with_search(user_query: str, system_prompt: str = None, chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Ask the AI with search capability

    Args:
        user_query: The user query
        system_prompt: The system prompt
        chat_history: The chat history

    Returns:
        Dict with the AI response and search actions
    """
    # First, get the AI's response
    ai_response = get_llama_response(
        prompt=user_query,
        system_prompt=system_prompt,
        chat_history=chat_history
    )

    # Check if the AI wants to search
    search_query = detect_search_intent(ai_response)

    if search_query:
        logger.info(f"AI wants to search for: {search_query}")

        # Process the search intent
        processed_response, search_actions = process_search_intent(ai_response)

        # If search was performed, ask the AI to summarize the results
        if search_actions:
            # Create a new prompt with the search results
            summary_prompt = f"Based on the search results in my previous response, please provide a concise summary answering the user's question: {user_query}"

            # Get the AI's summary
            summary_response = get_llama_response(
                prompt=summary_prompt,
                system_prompt=system_prompt,
                chat_history=chat_history + [
                    {"role": "assistant", "content": processed_response}
                ]
            )

            # Return the final response
            return {
                "response": summary_response,
                "search_actions": search_actions,
                "raw_response": ai_response,
                "processed_response": processed_response
            }

        return {
            "response": processed_response,
            "search_actions": search_actions,
            "raw_response": ai_response
        }

    # No search intent, return the original response
    return {
        "response": ai_response,
        "search_actions": [],
        "raw_response": ai_response
    }
