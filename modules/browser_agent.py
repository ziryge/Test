import asyncio
import os
import re
import json
import time
from typing import Dict, List, Optional, Union, Any
from playwright.async_api import async_playwright

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from modules.deepseek_function_wrapper import DeepseekFunctionWrapper
from modules.browser_use import browser_use_manager

class BrowserAgent:
    """
    A class to manage browser automation tasks using browser-use with Ollama LLM.
    """

    def __init__(self, model_name: str = "deepseek-r1:14b", max_steps: int = 15,
                 max_actions_per_step: int = 3, ollama_base_url: str = "http://localhost:11434"):
        """
        Initialize the BrowserAgent.

        Args:
            model_name: The name of the Ollama model to use
            max_steps: Maximum number of steps the agent will take
            max_actions_per_step: Maximum number of actions per step
            ollama_base_url: The base URL for the Ollama server
        """
        self.model_name = model_name
        self.max_steps = max_steps
        self.max_actions_per_step = max_actions_per_step
        self.ollama_base_url = ollama_base_url

    async def execute_task(self, task: str, memory: bool = True,
                       headless: bool = False) -> Dict[str, Union[str, List[str]]]:
        """
        Execute a browser automation task.

        Args:
            task: The task description for the browser agent
            memory: Whether to use memory functionality
            headless: Whether to run the browser in headless mode

        Returns:
            A dictionary containing the result and any captured screenshots
        """
        try:
            # Parse the task to determine what to do
            search_match = re.search(r"search for ['\"](.*?)['\"]|search for (.*?)(?:\.|$)", task, re.IGNORECASE)
            visit_match = re.search(r"(?:visit|go to|open|navigate to) ['\"](.*?)['\"]|(?:visit|go to|open|navigate to) (https?://\S+)", task, re.IGNORECASE)

            screenshots = []
            result_text = []

            # Use our custom wrapper for Deepseek that enables function calling
            llm = DeepseekFunctionWrapper(
                model_name=self.model_name,
                base_url=self.ollama_base_url,
                system_prompt=(
                    "You are a browser automation agent. Your task is to control a web browser to "
                    "accomplish user goals. You can navigate to websites, click on elements, fill forms, "
                    "and extract information. Always explain your actions before executing them, "
                    "and provide summaries of what you've found."
                )
            )

            # If it's a search task
            if search_match:
                search_query = search_match.group(1) or search_match.group(2)
                result_text.append(f"Searching for: {search_query}")

                # Use browser_use_manager to perform the search
                search_result = await browser_use_manager.search(search_query)

                if search_result.get("success", False):
                    # Add the screenshot to the list
                    if "screenshot" in search_result:
                        screenshots.append(search_result["screenshot"])

                    # Get the search results
                    result_text.append(f"Found search results at: {search_result.get('title', 'Google Search')}")
                    result_text.append(f"URL: {search_result.get('url', '')}")

                    # Ask the LLM to summarize the search results
                    summary_prompt = f"I searched for '{search_query}' and found results at {search_result.get('title', 'Google Search')}. Please summarize what I might have found based on this search query."
                    messages = [
                        {"role": "system", "content": "You are a helpful AI assistant."},
                        {"role": "user", "content": summary_prompt}
                    ]

                    # Get a response from the LLM
                    response = await self._get_llm_response(llm, messages)
                    result_text.append("\nSearch Results Summary:")
                    result_text.append(response)
                else:
                    result_text.append(f"Error searching for '{search_query}': {search_result.get('error', 'Unknown error')}")

            # If it's a visit task
            elif visit_match:
                url = visit_match.group(1) or visit_match.group(2)
                if not url.startswith(('http://', 'https://')):
                    url = 'https://' + url

                result_text.append(f"Visiting URL: {url}")

                # Use browser_use_manager to visit the URL
                visit_result = await browser_use_manager.go_to_url(url)

                if visit_result.get("success", False):
                    # Add the screenshot to the list
                    if "screenshot" in visit_result:
                        screenshots.append(visit_result["screenshot"])

                    # Get the page content
                    result_text.append(f"Successfully visited: {visit_result.get('title', url)}")
                    result_text.append(f"URL: {visit_result.get('url', url)}")

                    # Extract some content from the page
                    content_preview = visit_result.get("content", "")[:1000].replace("\n", " ").strip()
                    result_text.append(f"\nPage Content Preview: {content_preview}...")

                    # Ask the LLM to summarize the page content
                    summary_prompt = f"I visited the website '{url}' with title '{visit_result.get('title', '')}'. Please summarize what I might have found on this page based on the URL and title."
                    messages = [
                        {"role": "system", "content": "You are a helpful AI assistant."},
                        {"role": "user", "content": summary_prompt}
                    ]

                    # Get a response from the LLM
                    response = await self._get_llm_response(llm, messages)
                    result_text.append("\nPage Content Summary:")
                    result_text.append(response)
                else:
                    result_text.append(f"Error visiting '{url}': {visit_result.get('error', 'Unknown error')}")

            # If it's a general task
            else:
                # Ask the LLM to interpret the task
                interpret_prompt = f"I need to perform this browser task: '{task}'. Please explain how I should approach this task step by step."
                messages = [
                    {"role": "system", "content": "You are a helpful AI assistant."},
                    {"role": "user", "content": interpret_prompt}
                ]

                # Get a response from the LLM
                response = await self._get_llm_response(llm, messages)
                result_text.append("Task Interpretation:")
                result_text.append(response)

                # Try to search for the task as a fallback
                result_text.append("\nPerforming a search related to this task:")
                search_result = await browser_use_manager.search(task)

                if search_result.get("success", False):
                    # Add the screenshot to the list
                    if "screenshot" in search_result:
                        screenshots.append(search_result["screenshot"])

                    # Get the search results
                    result_text.append(f"Found search results at: {search_result.get('title', 'Google Search')}")
                    result_text.append(f"URL: {search_result.get('url', '')}")
                else:
                    result_text.append(f"Error searching for task information: {search_result.get('error', 'Unknown error')}")

            return {
                "status": "success",
                "result": "\n".join(result_text),
                "screenshots": screenshots
            }

        except Exception as e:
            return {
                "status": "error",
                "result": f"Error executing browser task: {str(e)}",
                "screenshots": []
            }

    async def _get_llm_response(self, llm, messages):
        """Helper method to get a response from the LLM"""
        try:
            # Generate a response using the Ollama model directly
            response = llm.ollama_model.invoke(messages[1]["content"])

            # Extract the text from the response
            if response and hasattr(response, "content"):
                return response.content
            return "No response generated."
        except Exception as e:
            return f"Error generating response: {str(e)}"

    @staticmethod
    def run_task(task: str, model_name: str = "deepseek-r1:14b",
                max_steps: int = 15, headless: bool = False,
                ollama_base_url: str = "http://localhost:11434") -> Dict[str, Union[str, List[str]]]:
        """
        Static method to run a browser task synchronously.

        Args:
            task: The task description
            model_name: The name of the Ollama model
            max_steps: Maximum number of steps
            headless: Whether to run the browser in headless mode
            ollama_base_url: The base URL for the Ollama server

        Returns:
            A dictionary containing the result and any captured screenshots
        """
        agent = BrowserAgent(
            model_name=model_name,
            max_steps=max_steps,
            ollama_base_url=ollama_base_url
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Initialize browser_use_manager if needed
            init_browser = loop.run_until_complete(browser_use_manager.initialize())

            # Execute the task
            result = loop.run_until_complete(agent.execute_task(task))
            return result
        except Exception as e:
            return {
                "status": "error",
                "result": f"Error running browser task: {str(e)}",
                "screenshots": []
            }
        finally:
            # Clean up browser resources
            try:
                loop.run_until_complete(browser_use_manager.close())
            except:
                pass
            loop.close()
