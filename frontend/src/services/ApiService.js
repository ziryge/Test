import axios from 'axios';

// Déterminer dynamiquement l'URL de base de l'API en fonction de l'environnement
const getApiBaseUrl = () => {
  // Si une variable d'environnement est définie, l'utiliser en priorité
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Si nous sommes dans un environnement GitHub Codespaces (ou similaire) où le frontend et
  // le backend sont servis depuis le même domaine
  if (window.location.hostname.includes('.app.github.dev') ||
      window.location.hostname.includes('.preview.app.github.dev')) {
    return `${window.location.origin}/api`;
  }

  // Fallback sur localhost pour le développement local
  // Changed to port 5002 to match the updated backend server
  return 'http://localhost:5002/api';
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Intercepteur pour gérer les erreurs globalement
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error.response || error);
        return Promise.reject(error);
      }
    );
  }

  // === Authentication API ===

  // Get Google OAuth URL
  async getGoogleAuthUrl() {
    const response = await this.client.get('/auth/google/url');
    return response.data.authUrl;
  }

  // Exchange Google code for tokens
  async exchangeGoogleCode(code) {
    const response = await this.client.post('/auth/google/callback', { code });
    return response.data;
  }

  // Verify current session
  async verifySession() {
    const response = await this.client.get('/auth/verify');
    return response.data;
  }

  // Logout
  async logout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  // === Status API ===

  // Obtenir le statut du système
  async getStatus() {
    const response = await this.client.get('/status');
    return response.data;
  }

  // === Chat API ===

  // Envoyer une requête au serveur (pour le chat)
  async sendQuery(message, options = {}) {
    const useStreaming = options.useStreaming !== undefined ? options.useStreaming : true;

    if (useStreaming) {
      return this.sendStreamingQuery(message, options);
    } else {
      const response = await this.client.post('/query', {
        query: message,
        useWebSearch: options.useWebSearch !== undefined ? options.useWebSearch : true,
        useMultiAgent: options.useMultiAgent !== undefined ? options.useMultiAgent : true,
        useStreaming: false
      });
      return response.data;
    }
  }

  // Envoyer une requête au serveur avec streaming (pour le chat)
  async sendStreamingQuery(message, options = {}) {
    return new Promise((resolve, reject) => {
      // Create a new AbortController
      const controller = new AbortController();
      const { signal } = controller;

      // Store the controller in the instance to allow cancellation
      this.currentStreamController = controller;

      // Prepare the request options
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          useWebSearch: options.useWebSearch !== undefined ? options.useWebSearch : true,
          useMultiAgent: options.useMultiAgent !== undefined ? options.useMultiAgent : true,
          useStreaming: true
        }),
        signal
      };

      // Initialize response data
      let responseData = {
        response: '',
        thinking: '',
        sources: [],
        model: '',
        usedWebSearch: false,
        usedMultiAgent: false,
        processingTime: 0,
        streaming: true
      };

      // Initialize callback functions
      const onChunk = options.onChunk || (() => {});
      const onThinking = options.onThinking || (() => {});
      const onDone = options.onDone || (() => {});

      // Make the fetch request
      fetch(`${API_BASE_URL}/query/stream`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Get a reader from the response body
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // Function to read chunks
          const readChunk = () => {
            reader.read().then(({ value, done }) => {
              if (done) {
                onDone(responseData);
                resolve(responseData);
                return;
              }

              // Decode the chunk
              const chunk = decoder.decode(value, { stream: true });

              // Split by newlines to handle multiple JSON objects
              const lines = chunk.split('\n').filter(line => line.trim());

              // Process each line
              lines.forEach(line => {
                try {
                  const data = JSON.parse(line);

                  // Handle different message types
                  if (data.type === 'metadata') {
                    responseData.thinking = data.thinking || '';
                    responseData.model = data.model || '';
                    responseData.usedWebSearch = data.usedWebSearch || false;
                    responseData.usedMultiAgent = data.usedMultiAgent || false;

                    // Call the thinking callback
                    onThinking(responseData.thinking);
                  }
                  else if (data.type === 'chunk') {
                    // Append the chunk to the response
                    responseData.response += data.content || '';

                    // Call the chunk callback
                    onChunk(data.content, responseData.response);
                  }
                  else if (data.type === 'done') {
                    // Update final response data
                    responseData.response = data.response || responseData.response;
                    responseData.processingTime = data.processingTime || 0;

                    // Call the done callback
                    onDone(responseData);
                    resolve(responseData);
                    return;
                  }
                } catch (error) {
                  console.error('Error parsing streaming response:', error, line);
                }
              });

              // Continue reading
              readChunk();
            }).catch(error => {
              if (error.name === 'AbortError') {
                console.log('Fetch aborted');
              } else {
                console.error('Error reading stream:', error);
                reject(error);
              }
            });
          };

          // Start reading
          readChunk();
        })
        .catch(error => {
          if (error.name === 'AbortError') {
            console.log('Fetch aborted');
          } else {
            console.error('Error with streaming request:', error);
            reject(error);
          }
        });
    });
  }

  // Cancel the current streaming request
  cancelStreaming() {
    if (this.currentStreamController) {
      this.currentStreamController.abort();
      this.currentStreamController = null;
    }
  }

  // Envoyer un message au système et obtenir une réponse
  async sendMessage(message, sessionId = null, options = {}) {
    const response = await this.client.post('/chat/message', {
      message,
      session_id: sessionId,
      options
    });
    return response.data;
  }

  // Créer une nouvelle session de chat
  async createChatSession(name = 'New Chat') {
    const response = await this.client.post('/chat/session', { name });
    return response.data;
  }

  // Obtenir l'historique d'une session de chat
  async getChatHistory(sessionId) {
    const response = await this.client.get(`/chat/session/${sessionId}/messages`);
    return response.data;
  }

  // Liste des sessions de chat
  async listChatSessions() {
    const response = await this.client.get('/chat/sessions');
    return response.data;
  }

  // === Multi-Agent API ===

  // Créer une nouvelle session multi-agents
  async createMultiAgentSession(task, options = {}) {
    const response = await this.client.post('/agents/session', {
      task,
      options
    });
    return response.data;
  }

  // Obtenir les détails d'une session multi-agents
  async getMultiAgentSession(sessionId) {
    const response = await this.client.get(`/agents/session/${sessionId}`);
    return response.data;
  }

  // Liste des sessions multi-agents
  async listMultiAgentSessions(limit = 10) {
    const response = await this.client.get(`/agents/sessions?limit=${limit}`);
    return response.data;
  }

  // Mettre en pause/reprendre une session multi-agents
  async toggleMultiAgentSessionPause(sessionId) {
    const response = await this.client.put(`/agents/session/${sessionId}/toggle-pause`);
    return response.data;
  }

  // Arrêter une session multi-agents
  async stopMultiAgentSession(sessionId) {
    const response = await this.client.put(`/agents/session/${sessionId}/stop`);
    return response.data;
  }

  // === Dashboard API ===

  // Obtenir les métriques pour le tableau de bord
  async getDashboardMetrics() {
    const response = await this.client.get('/dashboard/metrics');
    return response.data;
  }

  // Obtenir l'historique des sessions
  async getSessionsHistory(filter = {}) {
    const response = await this.client.get('/dashboard/sessions-history', {
      params: filter
    });
    return response.data;
  }

  // Obtenir les performances du système
  async getSystemPerformance() {
    const response = await this.client.get('/dashboard/system-performance');
    return response.data;
  }

  // === Outils et fonctionnalités supplémentaires ===

  // Télécharger un fichier
  async downloadFile(fileId) {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Téléverser un fichier
  async uploadFile(file, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };

    if (onProgress) {
      config.onUploadProgress = progressEvent => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      };
    }

    const response = await this.client.post('/files/upload', formData, config);
    return response.data;
  }

  // Obtenir les capacités du système
  async getSystemCapabilities() {
    const response = await this.client.get('/system/capabilities');
    return response.data;
  }

  // Exécuter une tâche spécifique
  async executeTask(task, parameters = {}) {
    const response = await this.client.post('/tasks/execute', {
      task,
      parameters
    });
    return response.data;
  }

  // WebSocket pour les événements en temps réel
  getWebSocketUrl(endpoint) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = API_BASE_URL.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${baseUrl}/${endpoint}`;
  }

  // === Tasks API ===

  // Obtenir la liste des tâches
  async getTasks(limit = 10, offset = 0) {
    const response = await this.client.get(`/tasks?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // Obtenir une tâche spécifique
  async getTask(taskId) {
    const response = await this.client.get(`/tasks/${taskId}`);
    return response.data;
  }

  // === Memory API ===

  // Obtenir les souvenirs récents
  async getMemories(limit = 10, offset = 0) {
    const response = await this.client.get(`/memories?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // Rechercher dans les souvenirs
  async searchMemories(query) {
    const response = await this.client.get(`/memories/search?query=${encodeURIComponent(query)}`);
    return response.data;
  }

  // Sauvegarder un contenu en mémoire
  async storeMemory(content, metadata = {}) {
    const response = await this.client.post('/memories', {
      content,
      metadata
    });
    return response.data;
  }
}

export default new ApiService();