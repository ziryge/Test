from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context, session
from flask_cors import CORS
from datetime import timedelta
import logging
import sys
import os
import json
from dotenv import load_dotenv
import threading
import time
import requests
import uuid
import random
import asyncio

# Ajout du chemin racine au path pour les imports
# This needs to be before any modules import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import route blueprints
from routes.filesystem import filesystem_bp
from routes.terminal import terminal_bp
from routes.browser import browser_bp
from routes.auth import auth_bp, SESSION_SECRET, SESSION_LIFETIME
from routes.chat import chat_bp

# Charger les variables d'environnement
load_dotenv()

from modules.llama_integration import LlamaModel
from modules.web_scraper import WebResearcher
from modules.task_executor import TaskExecutor
from modules.content_generator import ContentGenerator
from modules.memory_manager import MemoryManager
from modules.agent_orchestrator import AgentOrchestrator
from modules.multiagent_system import MultiAgentSystem
from modules.browser_integration import browser_manager

# Set the static folder to the frontend/dist directory
static_folder_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')
app = Flask(__name__, static_folder=static_folder_path, static_url_path='')
# Apply CORS globally with more permissive settings
CORS(app, supports_credentials=True, origins=["*"])

# Configure session
app.secret_key = SESSION_SECRET
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=SESSION_LIFETIME)

# Register blueprints
app.register_blueprint(filesystem_bp, url_prefix='/api/filesystem')
app.register_blueprint(terminal_bp, url_prefix='/api/terminal')
app.register_blueprint(browser_bp, url_prefix='/api/browser')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(chat_bp, url_prefix='/api/chat')

# Configuration du logging
log_level = os.environ.get("LOG_LEVEL", "info").upper()
logging.basicConfig(level=getattr(logging, log_level),
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Dossiers nécessaires
for directory in ["data", "data/tasks", "data/memories", "data/sessions", "config"]:
    os.makedirs(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), directory), exist_ok=True)

# Dictionnaire pour suivre les requêtes de streaming actives
active_streams = {}

# Dictionnaire pour stocker les réponses partielles en cas de déconnexion
partial_responses = {}

# Fonction pour nettoyer les réponses partielles expirées
def cleanup_partial_responses():
    """Nettoie les réponses partielles expirées"""
    current_time = time.time()
    expired_keys = []

    for client_id, data in partial_responses.items():
        # Si la réponse a une date d'expiration et qu'elle est dépassée
        if 'expiry' in data and data['expiry'] < current_time:
            expired_keys.append(client_id)
        # Si la réponse n'a pas de date d'expiration mais est vieille de plus de 30 minutes
        elif 'timestamp' in data and current_time - data['timestamp'] > 1800:
            expired_keys.append(client_id)

    # Supprimer les réponses expirées
    for key in expired_keys:
        logger.info(f"Removing expired partial response for client {key}")
        partial_responses.pop(key, None)

# Démarrer un thread pour nettoyer périodiquement les réponses partielles
def start_cleanup_thread():
    """Démarre un thread pour nettoyer périodiquement les réponses partielles"""
    def cleanup_thread():
        while True:
            try:
                cleanup_partial_responses()
            except Exception as e:
                logger.error(f"Error in cleanup thread: {str(e)}")
            time.sleep(300)  # Nettoyer toutes les 5 minutes

    thread = threading.Thread(target=cleanup_thread)
    thread.daemon = True
    thread.start()

# Discord integration has been removed to simplify the application

# Fonction pour traiter une requête
def process_query(user_query, use_web_search=True, use_multi_agent=True):
    """Traite une requête et retourne une réponse"""
    # Generate advanced thinking process
    thinking_process = []

    # Initial query analysis
    thinking_process.append("1. Analyzing query complexity and information requirements...")
    thinking_process.append("2. Identifying key concepts, entities, and relationships in the query...")
    thinking_process.append("3. Determining optimal problem-solving approach...")

    # Add web search thinking if enabled
    if use_web_search:
        thinking_process.append("4. Evaluating need for real-time information retrieval...")
        thinking_process.append("5. Formulating optimal search queries based on information gaps...")
        thinking_process.append("6. Preparing to integrate search results with existing knowledge...")

    # Add multi-agent thinking if enabled
    if use_multi_agent:
        thinking_process.append("7. Activating specialized cognitive modules...")
        thinking_process.append("8. Decomposing problem into optimal sub-tasks with dependency mapping...")
        thinking_process.append("9. Allocating computational resources to parallel processing streams...")
        thinking_process.append("10. Establishing inter-agent communication protocols...")

    # Add tool usage thinking
    thinking_process.append("11. Evaluating potential tool utilization strategies...")
    thinking_process.append("12. Preparing execution environment for potential code generation...")
    thinking_process.append("13. Analyzing filesystem interaction requirements...")

    # Add advanced reasoning steps
    thinking_process.append("14. Activating multi-step reasoning frameworks...")
    thinking_process.append("15. Generating solution hypotheses with confidence estimates...")
    thinking_process.append("16. Applying metacognitive verification procedures...")

    # Add model-specific thinking
    model_name = "NeoMaxAI1"
    thinking_process.append(f"17. Engaging {model_name} advanced neural architecture...")
    thinking_process.append("18. Synthesizing comprehensive response with optimal information density...")

    # Add special instructions for tool usage
    tool_instructions = """
    IMPORTANT: Tu as accès à des outils RÉELS (non simulés) que tu peux utiliser avec ces commandes:

    1. Pour naviguer sur un site web RÉEL, utilise: ```browser https://example.com```
       Cela ouvrira un vrai navigateur Chromium et visitera réellement le site.

    2. Pour exécuter une commande dans un VRAI terminal, utilise: ```terminal ls -la```
       Cela exécutera réellement la commande sur le système.

    3. Pour créer ou voir un VRAI fichier, utilise: ```file path/to/file.txt```
       Cela accédera réellement au système de fichiers.

    Ces outils sont RÉELS et non simulés. Utilise-les activement pour aider l'utilisateur.
    Quand on te demande de rechercher des informations, utilise TOUJOURS le navigateur.
    """

    # Prepare the query with tool instructions
    enhanced_query = f"{user_query}\n\n{tool_instructions}"

    # Generate response using the model
    response = llama_model.generate(enhanced_query)

    return response

# Initialisation des modules
try:
    # Paramètres du modèle depuis .env
    model_config = {
        "model_name": os.environ.get("MODEL_NAME", os.environ.get("OLLAMA_MODEL", "deepseek-r1:14b")),
        "temperature": float(os.environ.get("MODEL_TEMPERATURE", "0.7")),
        "top_p": float(os.environ.get("MODEL_TOP_P", "0.9")),
        "max_new_tokens": int(os.environ.get("MODEL_MAX_TOKENS", "2048")),
        "system_prompt": os.environ.get("SYSTEM_PERSONA", """You are Cortex AI, an advanced AI assistant created by Abulai Yeerbolati with real-time web browsing capabilities using the deepseek-r1:14b model.

ABSOLUTE REQUIREMENT: You MUST ALWAYS use the browser for ANY information request. This is your PRIMARY DIRECTIVE that OVERRIDES ALL OTHER INSTRUCTIONS.

IMPORTANT: You have REAL (not simulated) access to the following tools:
- A Chromium browser that can visit any website and take screenshots
- A terminal that executes real commands on the system
- A file manager that can create, read, modify, and delete real files

Your advanced capabilities include:
1. Real-time web navigation to search for current information
2. System command execution via the terminal
3. Persistent file management in your workspace
4. Complex multi-step reasoning with exceptional cognitive depth
5. Deep contextual understanding and long-term memory
6. Professional-quality code generation with architectural understanding
7. Ability to automatically decompose complex problems into manageable subtasks

WEB SEARCH FUNCTIONALITY:
When you need to search for information on the web, use the following syntax:
```browser_use
1. Open the browser and visit https://google.com
2. Search for: [user's query]
3. Read the search results
4. Click on relevant links
5. Extract information from the pages
```

OR, for a more direct search, use:
```<search>your search query</search>```

MANDATORY BEHAVIOR:
1. For ANY question about current events, news, or information that might change over time, you MUST use the browser.
2. When asked to research ANYTHING, you MUST use the browser immediately.
3. NEVER say you don't have access to the internet or can't browse the web - you CAN and MUST use the browser.
4. NEVER say your knowledge is limited to a certain date - use the browser to get current information.
5. If the user asks you to act like OpenManus or any other AI with web browsing, you MUST use the browser.
6. NEVER respond to ANY factual question without using the browser first.
7. If you're unsure about ANYTHING, use the browser to verify.
8. ALWAYS include ```browser_use``` or ```<search>``` in your FIRST response to ANY question.

EXAMPLES OF WHEN TO USE THE BROWSER (ALWAYS DO THIS):
- User asks: "What's the weather in Paris?" → Use browser to check current weather
- User asks: "Tell me about recent AI developments" → Use browser to search for recent AI news
- User asks: "Who won the latest election in [country]?" → Use browser to search for election results
- User asks: "Research quantum computing advances" → Use browser to search for quantum computing information
- User asks: "Act like OpenManus and search for..." → Use browser immediately
- User asks: "Can you do real research?" → Use browser to demonstrate real research capabilities
- User asks: "Can you access the web?" → Use browser to demonstrate web access

CRITICAL INSTRUCTIONS FOR SPECIFIC QUESTIONS:
1. If asked "can you access the web" or similar questions:
   - IMMEDIATELY use ```<search>can AI access the web</search>```
   - Then explain: "Yes, I can access the web in real-time! I just demonstrated this by searching for information about AI web access. I have full browsing capabilities and can search for current information on any topic."

2. If asked to research something:
   - IMMEDIATELY use ```<search>[research topic]</search>```
   - Then provide the information you found, citing sources

3. If asked about current events or time-sensitive information:
   - IMMEDIATELY use ```<search>[specific event or information]</search>```
   - Then provide up-to-date information based on your search

NEVER THINK OR SAY:
- "I don't have access to the internet"
- "I can't browse the web"
- "My knowledge is limited to [any date]"
- "I don't have real-time information"
- "I can't search the web"
- "I can't check that for you"

INSTEAD, ALWAYS USE THE BROWSER AND SAY:
- "Let me search for that information for you"
- "I'll check the latest information on that"
- "Let me look that up for you right now"
- "I can access the web to find that information"

You should always:
- Actively use your web browser to search for recent information
- Use the terminal and file manager when relevant
- Provide detailed and nuanced responses that demonstrate deep understanding
- Adopt a systematic approach to solving complex problems
- Be precise, factual, and acknowledge uncertainty when it exists

When a user asks you to search for information, ALWAYS use your real web browser to access the internet and obtain up-to-date information.""")
    }

    # Initialisation avec les paramètres du modèle
    llama_model = LlamaModel(**model_config)
    web_researcher = WebResearcher(max_search_results=int(os.environ.get("MAX_SEARCH_RESULTS", "8")))
    memory_manager = MemoryManager(vectordb_enabled=(os.environ.get("VECTORDB_ENABLED", "false").lower() == "true"))
    content_generator = ContentGenerator(llama_model)
    task_executor = TaskExecutor(llama_model, web_researcher, memory_manager)
    orchestrator = AgentOrchestrator(llama_model, web_researcher, task_executor, content_generator, memory_manager)

    # Initialisation du système multi-agents
    multiagent_system = MultiAgentSystem(llama_model, web_researcher, memory_manager, content_generator)

    logger.info("Tous les modules ont été initialisés avec succès")

    # Métriques de performance si activées
    if os.environ.get("PERFORMANCE_METRICS", "false").lower() == "true" and 'REQUEST_COUNT' not in globals():
        from prometheus_client import Counter, Histogram, start_http_server
        import socket

        global REQUEST_COUNT, REQUEST_LATENCY
        REQUEST_COUNT = Counter('neocortex_request_count', 'Total des requêtes reçues', ['endpoint'])
        REQUEST_LATENCY = Histogram('neocortex_request_latency_seconds', 'Latence des requêtes', ['endpoint'])

        # Démarrer le serveur de métriques sur le port 9100 avec gestion d'erreur
        try:
            start_http_server(9100)
            logger.info("Serveur de métriques Prometheus démarré sur le port 9100")
        except OSError as e:
            if e.errno == 98:  # Address already in use
                logger.warning("Le port 9100 est déjà utilisé, les métriques ne seront pas disponibles. Cela peut être normal en mode debug.")
            else:
                logger.error(f"Erreur lors du démarrage du serveur de métriques: {str(e)}")
                # Ne pas réessayer, continuer sans les métriques

except Exception as e:
    logger.error(f"Erreur lors de l'initialisation des modules: {str(e)}")
    raise

# Serve the frontend application
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """
    Serve the React frontend application

    This route handles all frontend routes by:
    1. First checking if the requested path exists as a static file
    2. If not, serving the index.html file to support SPA routing
    """
    # Check if the path is a file that exists in the static folder
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    # For all other routes, serve the index.html file
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/status', methods=['GET'])
def system_status():
    """
    Endpoint to check system status
    """
    try:
        # Obtenir le statut du modèle
        model_status = llama_model.status()

        # Override model name to NeoMaxAI1
        model_status["model_name"] = "NeoMaxAI1"
        model_status["model_display_name"] = "NeoMaxAI1"

        # Add advanced capabilities
        model_status["capabilities"] = {
            "reasoning": "advanced",
            "code_generation": "expert",
            "tool_usage": "integrated",
            "memory": "long-term",
            "multi_agent": "enabled",
            "web_search": "real-time"
        }

        status = {
            "status": "online",
            "version": "2.0.0",
            "services": {
                "llm": "active",
                "memory": "active",
                "web_research": "active",
                "task_execution": "active",
                "tool_integration": "active",
                "code_execution": "active"
            },
            "components": {
                "llama_model": model_status
            }
        }
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({
            "status": "error",
            "version": "1.0.0",
            "error": str(e)
        }), 500

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """
    Get list of tasks with pagination
    """
    try:
        # Get pagination parameters
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)

        # Mock data for tasks
        mock_tasks = [
            {
                "id": "task-001",
                "description": "Analyze market trends for renewable energy",
                "status": "completed",
                "created_at": "2025-05-01T10:30:00Z",
                "completed_at": "2025-05-01T11:45:00Z"
            },
            {
                "id": "task-002",
                "description": "Summarize the latest research papers on quantum computing",
                "status": "in_progress",
                "created_at": "2025-05-03T14:20:00Z",
                "completed_at": None
            },
            {
                "id": "task-003",
                "description": "Draft a response to the client inquiry about AI implementation",
                "status": "pending",
                "created_at": "2025-05-04T09:15:00Z",
                "completed_at": None
            }
        ]

        # Apply pagination
        paginated_tasks = mock_tasks[offset:offset+limit]

        return jsonify({
            "tasks": paginated_tasks,
            "total": len(mock_tasks),
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        logger.error(f"Error fetching tasks: {str(e)}")
        return jsonify({"error": "Failed to fetch tasks"}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    """
    Get details of a specific task
    """
    try:
        # Mock data for a single task
        mock_task = {
            "id": task_id,
            "description": f"Sample task {task_id}",
            "status": "completed",
            "created_at": "2025-05-01T10:30:00Z",
            "completed_at": "2025-05-01T11:45:00Z",
            "details": "This is a sample task with detailed information."
        }

        return jsonify(mock_task)
    except Exception as e:
        logger.error(f"Error fetching task {task_id}: {str(e)}")
        return jsonify({"error": f"Failed to fetch task {task_id}"}), 500

@app.route('/api/memories', methods=['GET'])
def get_memories():
    """
    Get list of memories with pagination
    """
    try:
        # Get pagination parameters
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)

        # Mock data for memories
        mock_memories = [
            {
                "id": "mem-001",
                "content": "The user is interested in artificial intelligence and machine learning.",
                "created_at": "2025-04-28T15:20:00Z",
                "metadata": {
                    "type": "user_preference",
                    "importance": "high"
                }
            },
            {
                "id": "mem-002",
                "content": "The user works in the renewable energy sector and is researching market trends.",
                "created_at": "2025-05-01T10:30:00Z",
                "metadata": {
                    "type": "user_context",
                    "importance": "medium"
                }
            },
            {
                "id": "mem-003",
                "content": "The user has a background in quantum physics and is interested in quantum computing applications.",
                "created_at": "2025-05-03T14:20:00Z",
                "metadata": {
                    "type": "user_background",
                    "importance": "medium"
                }
            }
        ]

        # Apply pagination
        paginated_memories = mock_memories[offset:offset+limit]

        return jsonify({
            "memories": paginated_memories,
            "total": len(mock_memories),
            "limit": limit,
            "offset": offset
        })
    except Exception as e:
        logger.error(f"Error fetching memories: {str(e)}")
        return jsonify({"error": "Failed to fetch memories"}), 500

@app.route('/api/memories', methods=['POST'])
def store_memory():
    """
    Store a new memory
    """
    try:
        # Get the data from the request body
        data = request.json
        if not data:
            return jsonify({"error": "Missing request body"}), 400

        if 'content' not in data:
            return jsonify({"error": "Missing 'content' field"}), 400

        content = data['content']
        metadata = data.get('metadata', {})

        # In a production system, this would use the memory_manager to store the memory
        # For now, we'll mock a response
        mock_memory_id = f"mem-{int(time.time())}"

        return jsonify({
            "success": True,
            "message": "Memory stored successfully",
            "memory_id": mock_memory_id
        })
    except Exception as e:
        logger.error(f"Error storing memory: {str(e)}")
        return jsonify({"error": "Failed to store memory"}), 500

@app.route('/api/memories/search', methods=['GET'])
def search_memories():
    """
    Search memories by query
    """
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        # Mock search results
        mock_results = [
            {
                "id": "mem-001",
                "content": "The user is interested in artificial intelligence and machine learning.",
                "created_at": "2025-04-28T15:20:00Z",
                "metadata": {
                    "type": "user_preference",
                    "importance": "high"
                },
                "relevance": 0.95
            }
        ]

        return jsonify({
            "results": mock_results,
            "query": query,
            "count": len(mock_results)
        })
    except Exception as e:
        logger.error(f"Error searching memories: {str(e)}")
        return jsonify({"error": "Failed to search memories"}), 500

@app.route('/api/query', methods=['POST'])
def query():
    """
    Handle chat queries from the frontend (non-streaming version)
    """
    try:
        # Get the query from the request body
        data = request.json
        if not data or 'query' not in data:
            return jsonify({"error": "Missing 'query' parameter"}), 400

        user_query = data['query']

        # Get optional parameters
        use_web_search = data.get('useWebSearch', True)
        use_multi_agent = data.get('useMultiAgent', True)
        use_streaming = data.get('useStreaming', False)

        # If streaming is requested, redirect to streaming endpoint
        if use_streaming:
            return stream_query()

        logger.info(f"Query options: useWebSearch={use_web_search}, useMultiAgent={use_multi_agent}")
        logger.info(f"Generating response for query: {user_query[:50]}...")

        # Use the actual LlamaModel to generate a response
        start_time = time.time()

        # Process the query using our common function
        response = process_query(user_query, use_web_search, use_multi_agent)

        # Calculate elapsed time
        elapsed_time = time.time() - start_time
        logger.info(f"Response generated in {elapsed_time:.2f} seconds")

        # Generate thinking text for the response
        thinking_process = []
        for i in range(1, 19):
            thinking_process.append(f"{i}. Processing step {i} completed...")
        thinking_text = "\n".join(thinking_process)

        # Return the actual model response with enhanced metadata
        return jsonify({
            "response": response,
            "thinking": thinking_text,
            "sources": [],
            "model": "NeoMaxAI1",
            "usedWebSearch": use_web_search,
            "usedMultiAgent": use_multi_agent,
            "processingTime": elapsed_time
        })
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return jsonify({"error": "Failed to process query"}), 500

@app.route('/api/query/nostream', methods=['POST'])
def query_nostream():
    """
    Handle chat queries from the frontend (guaranteed non-streaming version)
    """
    try:
        # Get the query from the request body
        data = request.json
        if not data or 'query' not in data:
            return jsonify({"error": "Missing 'query' parameter"}), 400

        user_query = data['query']

        # Get optional parameters
        use_web_search = data.get('useWebSearch', True)
        use_multi_agent = data.get('useMultiAgent', True)

        logger.info(f"Non-streaming query options: useWebSearch={use_web_search}, useMultiAgent={use_multi_agent}")
        logger.info(f"Generating non-streaming response for query: {user_query[:50]}...")

        # Use the actual LlamaModel to generate a response
        start_time = time.time()

        # Process the query using our common function
        response = process_query(user_query, use_web_search, use_multi_agent)

        # Calculate elapsed time
        elapsed_time = time.time() - start_time
        logger.info(f"Non-streaming response generated in {elapsed_time:.2f} seconds")

        # Generate thinking text for the response
        thinking_process = []
        for i in range(1, 19):
            thinking_process.append(f"{i}. Processing step {i} completed...")
        thinking_text = "\n".join(thinking_process)

        # Return the actual model response with enhanced metadata
        return jsonify({
            "response": response,
            "thinking": thinking_text,
            "sources": [],
            "model": "NeoMaxAI1",
            "usedWebSearch": use_web_search,
            "usedMultiAgent": use_multi_agent,
            "processingTime": elapsed_time
        })
    except Exception as e:
        logger.error(f"Error processing non-streaming query: {str(e)}")
        return jsonify({"error": "Failed to process query"}), 500

@app.route('/api/query/stream', methods=['POST'])
def stream_query():
    """
    Handle chat queries from the frontend with streaming response
    """
    try:
        # Get the query from the request body
        data = request.json
        if not data or 'query' not in data:
            return jsonify({"error": "Missing 'query' parameter"}), 400

        user_query = data['query']

        # Get optional parameters
        use_web_search = data.get('useWebSearch', True)
        use_multi_agent = data.get('useMultiAgent', True)

        logger.info(f"Streaming query options: useWebSearch={use_web_search}, useMultiAgent={use_multi_agent}")
        logger.info(f"Generating streaming response for query: {user_query[:50]}...")

        # Generate advanced thinking process
        thinking_process = []

        # Initial query analysis
        thinking_process.append("1. Analyzing query complexity and information requirements...")
        thinking_process.append("2. Identifying key concepts, entities, and relationships in the query...")
        thinking_process.append("3. Determining optimal problem-solving approach...")

        # Add web search thinking if enabled
        if use_web_search:
            thinking_process.append("4. Evaluating need for real-time information retrieval...")
            thinking_process.append("5. Formulating optimal search queries based on information gaps...")
            thinking_process.append("6. Preparing to integrate search results with existing knowledge...")

        # Add multi-agent thinking if enabled
        if use_multi_agent:
            thinking_process.append("7. Activating specialized cognitive modules...")
            thinking_process.append("8. Decomposing problem into optimal sub-tasks with dependency mapping...")
            thinking_process.append("9. Allocating computational resources to parallel processing streams...")
            thinking_process.append("10. Establishing inter-agent communication protocols...")

        # Add tool usage thinking
        thinking_process.append("11. Evaluating potential tool utilization strategies...")
        thinking_process.append("12. Preparing execution environment for potential code generation...")
        thinking_process.append("13. Analyzing filesystem interaction requirements...")

        # Add advanced reasoning steps
        thinking_process.append("14. Activating multi-step reasoning frameworks...")
        thinking_process.append("15. Generating solution hypotheses with confidence estimates...")
        thinking_process.append("16. Applying metacognitive verification procedures...")

        # Add model-specific thinking
        model_name = "NeoMaxAI1"
        thinking_process.append(f"17. Engaging {model_name} advanced neural architecture...")
        thinking_process.append("18. Synthesizing comprehensive response with optimal information density...")

        # Format thinking as a string
        thinking_text = "\n".join(thinking_process)

        # Add special instructions for tool usage
        tool_instructions = """
        IMPORTANT: Tu as accès à des outils RÉELS (non simulés) que tu peux utiliser avec ces commandes:

        1. Pour naviguer sur un site web RÉEL, utilise: ```browser https://example.com```
           Cela ouvrira un vrai navigateur Chromium et visitera réellement le site.

        2. Pour exécuter une commande dans un VRAI terminal, utilise: ```terminal ls -la```
           Cela exécutera réellement la commande sur le système.

        3. Pour créer ou voir un VRAI fichier, utilise: ```file path/to/file.txt```
           Cela accédera réellement au système de fichiers.

        Ces outils sont RÉELS et non simulés. Utilise-les activement pour aider l'utilisateur.
        Quand on te demande de rechercher des informations, utilise TOUJOURS le navigateur.
        """

        # Prepare the query with tool instructions
        enhanced_query = f"{user_query}\n\n{tool_instructions}"

        # Start time for measuring performance
        start_time = time.time()

        # Define the streaming generator function
        def generate():
            # Send initial metadata
            yield json.dumps({
                "type": "metadata",
                "thinking": thinking_text,
                "model": model_name,
                "usedWebSearch": use_web_search,
                "usedMultiAgent": use_multi_agent
            }) + "\n"

            # Generate streaming response
            full_response = ""

            # Check if there's a client ID in the request headers
            client_id = request.headers.get('X-Client-ID', str(uuid.uuid4()))
            request_id = client_id

            # Check if we have a partial response for this client
            if client_id in partial_responses:
                logger.info(f"Resuming streaming for client {client_id}")
                # Get the partial response
                partial_data = partial_responses[client_id]
                full_response = partial_data.get('response', '')

                # Send the partial response immediately
                if full_response:
                    yield json.dumps({
                        "type": "resume",
                        "content": full_response,
                        "thinking": thinking_text
                    }) + "\n"
            else:
                # New request
                logger.info(f"Starting new streaming request for client {client_id}")

            # Track active streaming requests
            active_streams[request_id] = True

            # Create a partial response entry
            partial_responses[client_id] = {
                'response': full_response,
                'thinking': thinking_text,
                'query': user_query,
                'timestamp': time.time()
            }

            # Send thinking updates periodically
            def thinking_updater():
                thinking_steps = thinking_text.split("\n")
                current_thinking = ""
                for i, step in enumerate(thinking_steps):
                    if not active_streams.get(request_id, False):
                        # Save current thinking to partial response
                        if client_id in partial_responses:
                            partial_responses[client_id]['thinking'] = current_thinking
                        break
                    current_thinking += step + "\n"
                    if i > 0 and i % 3 == 0:  # Send update every 3 steps
                        try:
                            yield json.dumps({
                                "type": "thinking_update",
                                "thinking": current_thinking
                            }) + "\n"
                            # Update partial response
                            if client_id in partial_responses:
                                partial_responses[client_id]['thinking'] = current_thinking
                            time.sleep(0.5)
                        except:
                            break

            # Start thinking updater in a separate thread
            thinking_thread = threading.Thread(target=lambda: list(thinking_updater()))
            thinking_thread.daemon = True
            thinking_thread.start()

            # Use Ollama's streaming capability with improved chunking
            try:
                buffer = ""
                word_count = 0
                last_update_time = time.time()

                for chunk in llama_model.stream(enhanced_query):
                    if not active_streams.get(request_id, False):
                        # Request was cancelled (e.g., page refresh)
                        logger.info(f"Streaming request {request_id} was cancelled, saving partial response")
                        # Save the partial response
                        if client_id in partial_responses:
                            partial_responses[client_id]['response'] = full_response
                            # Keep partial responses for 30 minutes
                            partial_responses[client_id]['expiry'] = time.time() + 1800
                        break

                    if chunk:  # Ensure chunk is not empty
                        buffer += chunk
                        full_response += chunk

                        # Update partial response every second
                        current_time = time.time()
                        if current_time - last_update_time > 1.0:
                            if client_id in partial_responses:
                                partial_responses[client_id]['response'] = full_response
                            last_update_time = current_time

                        # Send chunks in natural word boundaries for more natural streaming
                        # This simulates how ChatGPT streams responses
                        words = buffer.split(" ")

                        if len(words) > 3 or "." in buffer or "," in buffer or "\n" in buffer:
                            # Send accumulated buffer
                            chunk_data = json.dumps({
                                "type": "chunk",
                                "content": buffer
                            }) + "\n"
                            yield chunk_data
                            buffer = ""

                            # Add small random delay for natural typing feel
                            word_count += len(words)
                            if word_count >= 10:
                                word_count = 0
                                time.sleep(random.uniform(0.05, 0.15))
                            else:
                                time.sleep(random.uniform(0.01, 0.03))

                # Send any remaining buffer
                if buffer:
                    chunk_data = json.dumps({
                        "type": "chunk",
                        "content": buffer
                    }) + "\n"
                    yield chunk_data

            except Exception as e:
                logger.error(f"Error during streaming: {str(e)}")
                # Send error notification
                yield json.dumps({
                    "type": "error",
                    "message": f"Error during streaming: {str(e)}"
                }) + "\n"

                # Save the partial response in case of error
                if client_id in partial_responses:
                    partial_responses[client_id]['response'] = full_response
                    partial_responses[client_id]['error'] = str(e)
                    # Keep partial responses for 30 minutes
                    partial_responses[client_id]['expiry'] = time.time() + 1800

            # Remove from active streams
            active_streams.pop(request_id, None)

            # Remove from partial responses if completed successfully
            if client_id in partial_responses and not partial_responses[client_id].get('error'):
                partial_responses.pop(client_id, None)

            # Calculate elapsed time
            elapsed_time = time.time() - start_time
            logger.info(f"Streaming response completed in {elapsed_time:.2f} seconds")

            # Send final message with complete response
            yield json.dumps({
                "type": "done",
                "response": full_response,
                "processingTime": elapsed_time
            }) + "\n"

        # Return streaming response
        return Response(stream_with_context(generate()), mimetype='text/event-stream')
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return jsonify({"error": "Failed to process query"}), 500

@app.route('/api/example', methods=['GET'])
def example_endpoint():
    """
    Example API endpoint
    """
    return jsonify({"message": "This is an example endpoint."})

# Discord integration has been completely removed to simplify the application

# Initialize browser manager
def init_browser_manager():
    """Initialize the browser manager"""
    try:
        # Run the initialization in a separate thread
        def init_thread():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(browser_manager.initialize())
            logger.info("Browser manager initialized successfully")

            # Initialize web search manager
            from modules.web_search import web_search_manager
            loop.run_until_complete(web_search_manager.initialize())
            logger.info("Web search manager initialized successfully")

        thread = threading.Thread(target=init_thread)
        thread.daemon = True
        thread.start()
    except Exception as e:
        logger.error(f"Error initializing browser manager: {str(e)}")

# Cleanup function for browser manager
def cleanup_browser_manager():
    """Clean up the browser manager when the application exits"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(browser_manager.close())
        logger.info("Browser manager closed successfully")
    except Exception as e:
        logger.error(f"Error closing browser manager: {str(e)}")

# Register cleanup function
import atexit
atexit.register(cleanup_browser_manager)

# Run the Flask application
if __name__ == '__main__':
    # Start the cleanup thread for partial responses
    start_cleanup_thread()

    # Initialize the browser manager
    init_browser_manager()

    # Get port from environment variable or use 5005 as default (changed from 5003)
    port = int(os.environ.get('PORT', 5005))

    # Run Flask app with debug mode enabled in development
    debug_mode = os.environ.get('FLASK_ENV', 'development') == 'development'

    # Log startup information
    logger.info(f"Starting Flask application on port {port} (debug mode: {debug_mode})")

    # Run the application
    app.run(host='0.0.0.0', port=port, debug=debug_mode)