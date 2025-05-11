"""
Chat routes for the API.
This module handles all endpoints related to chat functionality.
"""

from flask import Blueprint, request, jsonify, session
import json
import os
import logging
import time
import sys
import re
import asyncio
import requests
from typing import Dict, List, Any, Optional, Tuple

# Remove the project root path addition since app.py already does this
# and we're using consistent absolute imports
# sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from modules.llama_integration import get_llama_response
from modules.memory_manager import MemoryManager
from modules.browser_integration import browser_manager
from modules.web_search import web_search_manager
from modules.ai_search_integration import process_search_intent
from modules.browser_use import browser_use_manager

# Initialize the chat blueprint
chat_bp = Blueprint('chat', __name__)

# Initialize the memory manager
memory_manager = MemoryManager(vectordb_enabled=True)

# Initialize logger
logger = logging.getLogger(__name__)

# Chat memory helper functions
def save_to_memory(user_id: str, chat_history: List[Dict[str, Any]]) -> str:
    """
    Save chat history to memory

    Args:
        user_id: The user ID
        chat_history: The chat history to save

    Returns:
        str: The memory ID
    """
    # Format the chat history as a string for storage
    chat_content = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history])

    # Store metadata about the chat
    metadata = {
        "type": "chat_history",
        "user_id": user_id,
        "timestamp": time.time(),
        "message_count": len(chat_history)
    }

    # Store in memory manager
    memory_id = memory_manager.store(chat_content, metadata)
    logger.info(f"Saved chat history to memory with ID: {memory_id}")

    return memory_id

def get_from_memory(user_id: str, query: str = None, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get chat history from memory

    Args:
        user_id: The user ID
        query: Optional search query
        limit: Maximum number of results to return

    Returns:
        List[Dict[str, Any]]: List of chat histories
    """
    if query:
        # Search for relevant memories
        memories = memory_manager.search(query, limit=limit)
    else:
        # Get all memories for this user
        all_memories = memory_manager.get_all_memories()
        memories = [
            mem for mem in all_memories
            if mem.get("metadata", {}).get("user_id") == user_id
            and mem.get("metadata", {}).get("type") == "chat_history"
        ]
        # Sort by timestamp (newest first)
        memories.sort(
            key=lambda x: x.get("metadata", {}).get("timestamp", 0),
            reverse=True
        )
        # Limit results
        memories = memories[:limit]

    return memories

# Helper function to run async functions
def run_async(coroutine):
    """Run an async function from a synchronous context"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coroutine)
    finally:
        loop.close()

def process_browser_use(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Process browser_use blocks in the text and replace them with the results

    Args:
        text: The text to process

    Returns:
        Tuple[str, List[Dict[str, Any]]]: The processed text and a list of browser actions
    """
    # Pattern to match browser_use blocks
    pattern = r"```browser_use\s+(.*?)```"
    browser_actions = []

    # Find all browser_use blocks
    matches = re.finditer(pattern, text, re.DOTALL)

    # If no matches, return the original text
    if not re.search(pattern, text, re.DOTALL):
        return text, browser_actions

    # Process each browser_use block
    for match in matches:
        browser_block = match.group(1).strip()

        # Check if this is a Google search - expanded pattern to catch more search intents
        search_pattern = r"(?:search for|search|look up|find information about|research|find|get information on|tell me about|what is|who is|when is|where is|why is|how is|what are|who are|when are|where are|why are|how are):?\s*(.+?)(?:$|\n)"
        search_match = re.search(search_pattern, browser_block, re.IGNORECASE)

        if search_match:
            # This is a search request
            search_query = search_match.group(1).strip()
            logger.info(f"Detected search request: {search_query}")

            try:
                # Try using our new browser_use_manager to perform a search
                search_result = run_async(browser_use_manager.search(search_query))

                if not search_result.get("success", False):
                    # Fall back to web_search_manager if browser_use_manager fails
                    search_result = run_async(web_search_manager.search_google(search_query))

                    # Record the browser action
                    browser_actions.append({
                        "query": search_query,
                        "url": f"https://www.google.com/search?q={search_query.replace(' ', '+')}",
                        "timestamp": time.time()
                    })

                    # Format the search results
                    search_results_text = []
                    search_results_text.append(f"I searched for: \"{search_query}\" and found:")

                    for i, result in enumerate(search_result["results"], 1):
                        search_results_text.append(f"{i}. {result['title']}")
                        search_results_text.append(f"   URL: {result['link']}")
                        search_results_text.append(f"   {result['snippet']}")
                        search_results_text.append("")
                else:
                    # Record the browser action from browser_use_manager
                    browser_actions.append({
                        "query": search_query,
                        "url": search_result.get("url", ""),
                        "title": search_result.get("title", ""),
                        "timestamp": search_result.get("timestamp", time.time()),
                        "screenshot": search_result.get("screenshot", "")
                    })

                    # Format the search results
                    search_results_text = []
                    search_results_text.append(f"I searched for: \"{search_query}\" and found results at {search_result.get('title', 'Google Search')}")

                # Create the replacement text
                replacement = "I used the browser to search Google:\n\n" + "\n".join(search_results_text) + "\n\nBased on these search results, I can provide you with information."

                # Replace the browser_use block with the results
                text = text.replace(match.group(0), replacement)
                continue

            except Exception as e:
                logger.error(f"Error performing Google search for {search_query}: {str(e)}")
                replacement = f"I tried to search for '{search_query}', but encountered an error: {str(e)}"
                text = text.replace(match.group(0), replacement)
                continue

        # Extract URLs from the browser block
        url_pattern = r"https?://[^\s)>]+"
        urls = re.findall(url_pattern, browser_block)

        if not urls:
            # No URLs found, try to extract domain names that might need https:// prefix
            domain_pattern = r"(?<![:/])(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9][-a-zA-Z0-9]+"
            domains = re.findall(domain_pattern, browser_block)

            if domains:
                urls = [f"https://{domain}" for domain in domains]
            elif "google.com" in browser_block.lower():
                # Default to Google if mentioned but no specific URL
                urls = ["https://www.google.com"]
            else:
                # No URLs or domains found, replace with error message
                replacement = "I tried to use the browser, but couldn't find any valid URLs in my instructions."
                text = text.replace(match.group(0), replacement)
                continue

        # Process each URL
        browser_results = []
        for url in urls:
            logger.info(f"Processing browser use for URL: {url}")

            try:
                # Try using our new browser_use_manager first
                result = run_async(browser_use_manager.go_to_url(url))

                if not result.get("success", False):
                    # Fall back to browser_manager if browser_use_manager fails
                    result = run_async(browser_manager.open_browser(url))

                    # Record the browser action
                    browser_actions.append({
                        "url": url,
                        "title": result["title"],
                        "browser_id": result["browser_id"],
                        "timestamp": time.time()
                    })

                    # Add the result to the browser results
                    browser_results.append(f"- Visited {url} - Title: \"{result['title']}\"")

                    # Add a summary of the content
                    content_preview = result["content"][:500].replace("\n", " ").strip()
                else:
                    # Record the browser action from browser_use_manager
                    browser_actions.append({
                        "url": url,
                        "title": result.get("title", ""),
                        "timestamp": result.get("timestamp", time.time()),
                        "screenshot": result.get("screenshot", "")
                    })

                    # Add the result to the browser results
                    browser_results.append(f"- Visited {url} - Title: \"{result.get('title', '')}\"")

                    # Add a summary of the content
                    content_preview = result.get("content", "")[:500].replace("\n", " ").strip()

                browser_results.append(f"  Content preview: \"{content_preview}...\"")

            except Exception as e:
                logger.error(f"Error processing browser use for URL {url}: {str(e)}")
                browser_results.append(f"- Error visiting {url}: {str(e)}")

        # Create the replacement text
        replacement = "I used the browser to visit the following websites:\n" + "\n".join(browser_results) + "\n\nI can now provide information based on what I found."

        # Replace the browser_use block with the results
        text = text.replace(match.group(0), replacement)

    return text, browser_actions

@chat_bp.route('/message', methods=['POST'])
def send_message():
    """Handle sending messages to the AI"""
    try:
        data = request.json
        message = data.get('message', '')
        history = data.get('history', [])

        # Get user ID from session
        user_id = session.get('user_id', 'anonymous')

        # Add the new message to history
        history.append({"role": "user", "content": message})

        # Get the system prompt from app.py
        from api.app import model_config
        system_prompt = model_config.get("system_prompt", "You are Cortex AI, an advanced AI assistant with real-time web browsing capabilities.")

        # ALWAYS force browser use for any message
        # Get response from LLM
        response = get_llama_response(
            prompt=message,
            system_prompt=system_prompt,
            chat_history=history[:-1]  # Exclude the latest message as it's passed as prompt
        )

        # If the response doesn't include browser use or search, force it
        if not ("<search>" in response or "```browser_use" in response):
            # Extract a search query from the message
            search_query = message.strip().replace("?", "").replace(".", "")

            # Special handling for specific types of questions
            if re.search(r"(?:can you|do you|are you able to).*(?:access|browse|search|use).*(?:web|internet|online)", message, re.IGNORECASE):
                # Web access question
                search_query = "can AI access the web"
                forced_search = f"<search>{search_query}</search>\n\nYes, I can absolutely access the web! I'm demonstrating this capability right now by searching for information about AI web access. I have real-time browsing capabilities that allow me to search for and retrieve current information from the internet."
            elif re.search(r"(?:research|find information|look up|tell me about|what is|who is|when|where|why|how)", message, re.IGNORECASE):
                # Research or information question
                forced_search = f"<search>{search_query}</search>\n\nI'm searching for information about '{search_query}' using my real-time web browsing capabilities. Here's what I found:"
            elif re.search(r"(?:weather|news|latest|current|recent|today|now)", message, re.IGNORECASE):
                # Time-sensitive information
                forced_search = f"<search>{search_query}</search>\n\nLet me check the latest information about '{search_query}' for you using my real-time web access:"
            else:
                # Default case - use browser_use
                forced_search = f"```browser_use\n1. Open the browser and visit https://google.com\n2. Search for: {search_query}\n3. Read the search results\n```\n\nI'm using my browser to search for information about '{search_query}'. Here's what I found:"

            response = forced_search

        # Process browser_use blocks in the response
        processed_response, browser_actions = process_browser_use(response)

        # Process search intents in the response
        processed_response, search_actions = process_search_intent(processed_response)

        # Combine browser actions
        all_browser_actions = browser_actions + search_actions

        # Add AI response to history
        history.append({"role": "assistant", "content": processed_response, "browserActions": all_browser_actions})

        # Save to memory if history has more than 1 exchange
        if len(history) >= 4:  # At least 2 messages from user and 2 from assistant
            save_to_memory(user_id, history)

        return jsonify({
            "success": True,
            "message": processed_response,
            "history": history,
            "browser_actions": all_browser_actions
        })

    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_bp.route('/history', methods=['GET'])
def get_chat_history():
    """Get the chat history for a user"""
    try:
        # Get user ID from session
        user_id = session.get('user_id', 'anonymous')

        # Get query parameter if present
        query = request.args.get('query', None)
        limit = int(request.args.get('limit', 5))

        # Get chat history from memory
        chat_memories = get_from_memory(user_id, query, limit)

        # Format response
        chat_histories = []
        for mem in chat_memories:
            # Parse the content back into messages
            content = mem.get("content", "")
            lines = content.split('\n')
            messages = []

            for line in lines:
                if line.startswith("user: "):
                    messages.append({"role": "user", "content": line[6:]})
                elif line.startswith("assistant: "):
                    messages.append({"role": "assistant", "content": line[11:]})

            chat_histories.append({
                "id": mem.get("id"),
                "messages": messages,
                "timestamp": mem.get("metadata", {}).get("timestamp")
            })

        return jsonify({
            "success": True,
            "histories": chat_histories
        })

    except Exception as e:
        logger.error(f"Error in get_chat_history: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_bp.route('/history/<history_id>', methods=['GET'])
def get_specific_chat_history(history_id):
    """Get a specific chat history by ID"""
    try:
        # Get the memory
        memory = memory_manager.get(history_id)

        if not memory:
            return jsonify({
                "success": False,
                "error": "Chat history not found"
            }), 404

        # Parse the content back into messages
        content = memory.get("content", "")
        lines = content.split('\n')
        messages = []

        for line in lines:
            if line.startswith("user: "):
                messages.append({"role": "user", "content": line[6:]})
            elif line.startswith("assistant: "):
                messages.append({"role": "assistant", "content": line[11:]})

        return jsonify({
            "success": True,
            "id": memory.get("id"),
            "messages": messages,
            "timestamp": memory.get("metadata", {}).get("timestamp")
        })

    except Exception as e:
        logger.error(f"Error in get_specific_chat_history: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_bp.route('/history/<history_id>', methods=['DELETE'])
def delete_chat_history(history_id):
    """Delete a specific chat history"""
    try:
        # Delete the memory
        success = memory_manager.delete(history_id)

        if not success:
            return jsonify({
                "success": False,
                "error": "Chat history not found"
            }), 404

        return jsonify({
            "success": True,
            "message": f"Chat history {history_id} deleted successfully"
        })

    except Exception as e:
        logger.error(f"Error in delete_chat_history: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500