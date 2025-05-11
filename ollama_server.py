from flask import Flask, jsonify, request, Response, stream_with_context, send_file
from flask_cors import CORS
import json
import time
import requests
import sys
import os
import base64
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import tempfile
from PIL import Image
from io import BytesIO

app = Flask(__name__)
# Configure CORS to allow requests from any origin with credentials
CORS(app,
     resources={r"/api/*": {"origins": "*", "supports_credentials": True}},
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Cache-Control", "Pragma", "Expires",
                   "X-Timestamp", "X-Client-ID", "X-No-Refresh", "cache-control"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization"])

# Ollama API settings
OLLAMA_API_BASE = "http://localhost:11434/api"
OLLAMA_MODEL = "deepseek-browser"  # Use our browser-optimized model

# Check if Ollama is running and the model is available
def check_ollama_status():
    try:
        print("Checking Ollama status...")
        # Check if Ollama is running
        response = requests.get(f"{OLLAMA_API_BASE}/tags")
        if response.status_code != 200:
            print(f"Ollama API returned status code {response.status_code}")
            return False

        # Check if the model is available
        models = response.json().get("models", [])
        model_names = [m.get("name") for m in models]
        print(f"Available models: {model_names}")

        # Check for the model with or without the :latest suffix
        for model in models:
            model_name = model.get("name", "")
            if model_name == OLLAMA_MODEL or model_name == f"{OLLAMA_MODEL}:latest":
                print(f"Found {model_name} in Ollama")
                return True

        print(f"Model {OLLAMA_MODEL} not found in Ollama")
        return False
    except Exception as e:
        print(f"Error checking Ollama status: {str(e)}")
        return False

# Check Ollama status
ollama_available = check_ollama_status()
print(f"Ollama status: {'available' if ollama_available else 'not available'}")

@app.route('/api/status', methods=['GET'])
def status():
    # Check if Ollama is available
    model_status = "active" if ollama_available else "loading"

    return jsonify({
        "status": "online",
        "version": "2.0.0",
        "services": {
            "llm": model_status,
            "memory": "active",
            "web_research": "active",
            "task_execution": "active",
            "tool_integration": "active",
            "code_execution": "active"
        },
        "components": {
            "llama_model": {
                "model_name": OLLAMA_MODEL,
                "model_display_name": "Deepseek-R1:14B",
                "model_status": model_status,
                "capabilities": {
                    "reasoning": "advanced",
                    "code_generation": "expert",
                    "tool_usage": "integrated",
                    "memory": "long-term",
                    "multi_agent": "enabled",
                    "web_search": "real-time"
                }
            }
        }
    })

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    return jsonify({
        "conversations": []
    })

@app.route('/api/chat/history/<history_id>', methods=['GET'])
def get_chat_session(history_id):
    return jsonify({
        "messages": []
    })

def generate_response(message, history=None):
    """Generate a response using the deepseek-r1:14b model from Ollama"""
    if not ollama_available:
        # If Ollama isn't available, return a waiting message
        print("Ollama not available, sending loading message")
        yield json.dumps({"type": "chunk", "content": "The deepseek-r1:14b model is still loading. "}) + "\n"
        yield json.dumps({"type": "chunk", "content": "Please wait a moment while Ollama initializes. "}) + "\n"
        yield json.dumps({"type": "complete", "content": "The deepseek-r1:14b model is still loading. Please wait a moment while Ollama initializes."}) + "\n"
        return

    try:
        print(f"Generating response using Ollama's {OLLAMA_MODEL} for: {message[:50]}...")

        # Format the prompt for the model with Cortex AI identity
        system_prompt = """You are Cortex AI, an advanced AI assistant created by Abulai Yeerbolati.
You have access to a browser and can search the web, visit websites, and take screenshots to help users.
When users ask you to search for information or visit websites, actively use your browser capabilities.

IMPORTANT: When asked if you can access the web, ALWAYS respond with:
"Yes, I can access the web in real-time! I have full browsing capabilities and can search for current information on any topic. Let me demonstrate this by searching for something for you."

Then immediately use one of these formats to search:
1. For web searches: <search>your search query</search>
2. For browser automation: ```browser_use
1. Open the browser and visit https://google.com
2. Search for: your search query
3. Read the search results
```

NEVER say you can't access the web or that your knowledge is limited to a certain date.
ALWAYS use your browser capabilities when asked about current events, news, or any factual information.
You can take screenshots of websites to show users what you're seeing.
Respond directly to the user's questions without using <think> tags or showing your internal thought process.
Always identify yourself as Cortex AI by Abulai Yeerbolati when introducing yourself."""

        # Build the messages array for the chat API
        messages = [{"role": "system", "content": system_prompt}]

        if history is not None:
            for msg in history:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "user":
                    messages.append({"role": "user", "content": content})
                elif role == "assistant":
                    messages.append({"role": "assistant", "content": content})

        # Add the current message
        messages.append({"role": "user", "content": message})

        print(f"Messages: {messages[:2]}...")

        # Prepare the request to Ollama using the chat API
        data = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 1000,
                # Try to reduce memory usage
                "num_ctx": 2048,  # Reduce context window
                "num_gpu": 99,    # Use all available GPU memory
                "num_thread": 8   # Limit CPU threads
            }
        }

        # Make the request to Ollama using the chat API
        print("Sending request to Ollama...")
        response = requests.post(
            f"{OLLAMA_API_BASE}/chat",
            json=data,
            stream=True,
            headers={"Content-Type": "application/json"}
        )

        # Stream the response
        full_response = ""
        print("Starting to stream response from Ollama...")

        for line in response.iter_lines():
            if line:
                try:
                    line_str = line.decode('utf-8')
                    print(f"Received chunk: {line_str[:100]}...")
                    chunk = json.loads(line_str)

                    # Check for error response
                    if "error" in chunk:
                        error_msg = chunk.get("error", "Unknown error")
                        print(f"Error from Ollama: {error_msg}")

                        # Just log the error but don't show it to the user
                        # Continue trying to process the request
                        continue

                    # Extract the response - handle both chat and generate API formats
                    if "message" in chunk and "content" in chunk["message"]:
                        # Chat API format
                        content = chunk["message"]["content"]
                    else:
                        # Generate API format (fallback)
                        content = chunk.get("response", "")

                    if content:
                        # Skip chunks that only contain <think> tags
                        if content.strip() == "<think>" or content.strip() == "</think>":
                            continue

                        # Filter out <think> tags and their contents from this chunk
                        import re
                        filtered_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)

                        # Also handle unclosed <think> tags (start of thinking)
                        filtered_content = re.sub(r'<think>.*$', '', filtered_content, flags=re.DOTALL)

                        # Also handle unopened </think> tags (end of thinking)
                        filtered_content = re.sub(r'^.*?</think>', '', filtered_content, flags=re.DOTALL)

                        # Only send non-empty content after filtering
                        if filtered_content.strip():
                            print(f"Filtered content: {filtered_content[:50]}...")
                            full_response += filtered_content
                            yield json.dumps({"type": "chunk", "content": filtered_content}) + "\n"
                            sys.stdout.flush()  # Force output to be displayed immediately
                except Exception as e:
                    print(f"Error parsing chunk: {str(e)}, chunk: {line[:100]}...")

        # Send the final complete message
        # Filter out any remaining <think> tags from the full response
        import re

        # First, filter out complete <think>...</think> blocks
        filtered_response = re.sub(r'<think>.*?</think>', '', full_response, flags=re.DOTALL)

        # Then handle any unclosed <think> tags (in case the response ends with thinking)
        filtered_response = re.sub(r'<think>.*$', '', filtered_response, flags=re.DOTALL)

        # Also handle any unopened </think> tags (in case the response starts with the end of thinking)
        filtered_response = re.sub(r'^.*?</think>', '', filtered_response, flags=re.DOTALL)

        # Clean up extra newlines and whitespace
        filtered_response = re.sub(r'\n\s*\n', '\n', filtered_response)
        filtered_response = filtered_response.strip()

        print(f"Streaming complete. Filtered response: {filtered_response[:100]}...")
        yield json.dumps({"type": "done", "response": filtered_response}) + "\n"
        print(f"Response generation complete. Original length: {len(full_response)}, Filtered length: {len(filtered_response)}")

    except Exception as e:
        print(f"Error generating response: {str(e)}")
        # If there's an error, return an error message
        error_message = f"Error generating response with the deepseek-r1:14b model. Error details: {str(e)}"
        yield json.dumps({"type": "chunk", "content": "Error generating response with the deepseek-r1:14b model. "}) + "\n"
        yield json.dumps({"type": "done", "response": error_message}) + "\n"

@app.route('/api/chat/message', methods=['POST', 'OPTIONS'])
def send_message():
    if request.method == 'OPTIONS':
        # Handle preflight request
        return jsonify({'status': 'ok'})

    data = request.json
    message = data.get('message', '')
    history = data.get('history', [])
    use_streaming = data.get('streaming', True)

    print(f"Received message: {message[:50]}...")

    if not use_streaming:
        # Non-streaming response for backward compatibility
        return jsonify({
            "message": "This is a test response from the API server.",
            "history": history + [
                {"role": "user", "content": message, "timestamp": time.time()},
                {"role": "assistant", "content": "This is a test response from the API server.", "timestamp": time.time()}
            ],
            "history_id": "test-history-id"
        })

    # Streaming response using the deepseek model
    def generate():
        for chunk in generate_response(message, history):
            yield chunk

    response = Response(stream_with_context(generate()), mimetype='text/event-stream')
    response.headers.add('Cache-Control', 'no-cache')
    response.headers.add('Connection', 'keep-alive')
    return response

@app.route('/api/chat/message/stream', methods=['POST', 'OPTIONS'])
def stream_message():
    """Dedicated endpoint for streaming responses"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        return jsonify({'status': 'ok'})

    data = request.json
    message = data.get('message', '')
    history = data.get('history', [])

    print(f"Received streaming request for message: {message[:50]}...")

    def generate():
        for chunk in generate_response(message, history):
            yield chunk

    response = Response(stream_with_context(generate()), mimetype='text/event-stream')
    response.headers.add('Cache-Control', 'no-cache')
    response.headers.add('Connection', 'keep-alive')
    return response

@app.route('/api/chat/reset/<session_id>', methods=['POST', 'GET', 'OPTIONS'])
def reset_chat(session_id):
    """Reset a chat session or create a new one"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        return jsonify({'status': 'ok'})

    print(f"Resetting chat session: {session_id}")

    # In a real implementation, you would clear the chat history for this session
    # For now, we'll just return a success response

    return jsonify({
        "success": True,
        "session_id": session_id,
        "message": f"Chat session {session_id} has been reset"
    })

# Initialize browser for screenshots and web browsing
# Real browser implementation
def get_browser():
    print("Creating real browser instance")

    # Configure Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")  # Use the new headless mode
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")

    # Add user agent to appear as a regular browser
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

    # Enable JavaScript
    chrome_options.add_argument("--enable-javascript")

    try:
        # Try to create the browser directly
        browser = webdriver.Chrome(options=chrome_options)
        print("Successfully created Chrome browser")

        # Set page load timeout
        browser.set_page_load_timeout(30)
        return browser
    except Exception as e:
        print(f"Error creating Chrome browser: {str(e)}")

        # If Chrome fails, try Firefox
        try:
            from selenium.webdriver.firefox.options import Options as FirefoxOptions
            from selenium.webdriver.firefox.service import Service as FirefoxService

            firefox_options = FirefoxOptions()
            firefox_options.add_argument("--headless")

            browser = webdriver.Firefox(options=firefox_options)
            print("Successfully created Firefox browser")

            # Set page load timeout
            browser.set_page_load_timeout(30)
            return browser
        except Exception as e2:
            print(f"Error creating Firefox browser: {str(e2)}")

            # If all browsers fail, raise an exception
            raise Exception(f"Failed to create any browser: {str(e)}, {str(e2)}")

# Global browser instance for reuse
_browser_instance = None

def get_browser_instance():
    global _browser_instance
    if _browser_instance is None:
        _browser_instance = get_browser()
    return _browser_instance

def close_browser_instance():
    global _browser_instance
    if _browser_instance is not None:
        try:
            _browser_instance.quit()
        except:
            pass
        _browser_instance = None

@app.route('/api/browser/visit', methods=['POST'])
def visit_website():
    """Visit a website and return its content and metadata"""
    data = request.json
    url = data.get('url', '')

    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        # Get browser instance
        browser = get_browser_instance()

        # Navigate to URL
        print(f"Visiting website: {url}...")
        browser.get(url)

        # Wait for page to load
        time.sleep(3)

        # Get page title
        title = browser.title

        # Get page content
        content = browser.page_source

        # Take screenshot
        screenshot = browser.get_screenshot_as_png()

        # Convert to base64
        encoded_image = base64.b64encode(screenshot).decode('utf-8')

        # Save screenshot to temp file
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Generate unique filename
        filename = f"screenshot_{int(time.time())}.png"
        filepath = os.path.join(temp_dir, filename)

        # Save the image
        with open(filepath, 'wb') as f:
            f.write(screenshot)

        # Extract metadata
        current_url = browser.current_url  # In case of redirects

        return jsonify({
            "success": True,
            "url": current_url,
            "title": title,
            "content_length": len(content),
            "screenshot": encoded_image,
            "filename": filename,
            "timestamp": time.time()
        })

    except Exception as e:
        print(f"Error visiting website: {str(e)}")
        return jsonify({"error": f"Failed to visit website: {str(e)}"}), 500

@app.route('/api/browser/screenshot', methods=['POST'])
def take_screenshot():
    """Take a screenshot of a website and return it as base64 encoded image"""
    data = request.json
    url = data.get('url', '')

    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        # Get browser instance
        browser = get_browser_instance()

        # Navigate to URL
        print(f"Taking screenshot of {url}...")
        browser.get(url)

        # Wait for page to load
        time.sleep(3)

        # Take screenshot
        screenshot = browser.get_screenshot_as_png()

        # Convert to base64
        encoded_image = base64.b64encode(screenshot).decode('utf-8')

        # Save screenshot to temp file
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Generate unique filename
        filename = f"screenshot_{int(time.time())}.png"
        filepath = os.path.join(temp_dir, filename)

        # Save the image
        with open(filepath, 'wb') as f:
            f.write(screenshot)

        return jsonify({
            "success": True,
            "screenshot": encoded_image,
            "filename": filename,
            "url": browser.current_url,
            "title": browser.title
        })

    except Exception as e:
        print(f"Error taking screenshot: {str(e)}")
        return jsonify({"error": f"Failed to take screenshot: {str(e)}"}), 500

@app.route('/api/browser/screenshots/<filename>', methods=['GET'])
def get_screenshot(filename):
    """Return a screenshot by filename"""
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
    filepath = os.path.join(temp_dir, filename)

    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/png')
    else:
        return jsonify({"error": "Screenshot not found"}), 404

@app.route('/api/browser/search', methods=['POST'])
def search_web():
    """Search the web using a search engine"""
    data = request.json
    query = data.get('query', '')

    if not query:
        return jsonify({"error": "Search query is required"}), 400

    try:
        # Get browser instance
        browser = get_browser_instance()

        # Format search URL (using Google)
        search_url = f"https://www.google.com/search?q={requests.utils.quote(query)}"

        # Navigate to search URL
        print(f"Searching for: {query}...")
        browser.get(search_url)

        # Wait for page to load
        time.sleep(3)

        # Take screenshot
        screenshot = browser.get_screenshot_as_png()

        # Convert to base64
        encoded_image = base64.b64encode(screenshot).decode('utf-8')

        # Save screenshot to temp file
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
        os.makedirs(temp_dir, exist_ok=True)

        # Generate unique filename
        filename = f"search_{int(time.time())}.png"
        filepath = os.path.join(temp_dir, filename)

        # Save the image
        with open(filepath, 'wb') as f:
            f.write(screenshot)

        # Extract search results
        # This is a simple implementation - in a real app, you'd parse the HTML more carefully
        page_source = browser.page_source

        return jsonify({
            "success": True,
            "query": query,
            "screenshot": encoded_image,
            "filename": filename,
            "url": browser.current_url,
            "title": browser.title,
            "timestamp": time.time()
        })

    except Exception as e:
        print(f"Error searching web: {str(e)}")
        return jsonify({"error": f"Failed to search web: {str(e)}"}), 500

# Add browser agent functionality
@app.route('/api/browser/agent', methods=['POST'])
def browser_agent():
    """Use the browser agent to perform a task"""
    data = request.json
    task = data.get('task', '')
    model_name = data.get('model_name', 'deepseek-browser')
    headless = data.get('headless', False)

    if not task:
        return jsonify({"error": "Task description is required"}), 400

    try:
        # Import the BrowserAgent class
        from modules.browser_agent import BrowserAgent

        # Run the task
        print(f"Running browser agent task: {task}")
        result = BrowserAgent.run_task(
            task=task,
            model_name=model_name,
            max_steps=15,
            headless=headless,
            ollama_base_url="http://localhost:11434"
        )

        return jsonify(result)
    except Exception as e:
        print(f"Error running browser agent task: {str(e)}")
        return jsonify({"error": f"Failed to run browser agent task: {str(e)}"}), 500

@app.route('/api/browser/list', methods=['GET'])
def list_browsers():
    """List all active browsers"""
    try:
        print("Listing active browsers")

        # For now, return an empty list since we don't have a proper browser manager yet
        browsers = []

        return jsonify({"browsers": browsers})
    except Exception as e:
        print(f"Error listing browsers: {str(e)}")
        return jsonify({"error": f"Failed to list browsers: {str(e)}"}), 500

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Get the system status"""
    try:
        # Check if Ollama is running
        ollama_status = check_ollama_status()

        return jsonify({
            "status": "ok",
            "ollama_status": ollama_status,
            "model": OLLAMA_MODEL,
            "version": "1.0.0",
            "browser_support": True
        })
    except Exception as e:
        print(f"Error getting system status: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e),
            "ollama_status": False,
            "model": OLLAMA_MODEL,
            "version": "1.0.0",
            "browser_support": True
        }), 500

# Clean up browser on exit
@app.teardown_appcontext
def teardown_browser(exception=None):
    close_browser_instance()

if __name__ == '__main__':
    # Create temp directory for screenshots
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
    os.makedirs(temp_dir, exist_ok=True)

    print("Starting API server on port 5005...")
    print(f"Using Ollama model: {OLLAMA_MODEL}")

    try:
        app.run(host='0.0.0.0', port=5005, debug=True)
    finally:
        # Ensure browser is closed when server stops
        close_browser_instance()
