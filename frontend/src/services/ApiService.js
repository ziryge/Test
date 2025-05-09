import axios from 'axios';
// We don't need to import safeRefresh since we're not using it in this file

// Déterminer dynamiquement l'URL de base de l'API en fonction de l'environnement
const getApiBaseUrl = () => {
  // Si une variable d'environnement est définie, l'utiliser en priorité
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('Using API URL from environment:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Disable automatic page refreshes
  window._preventAutoRefresh = true;

  // Si nous sommes dans un environnement GitHub Codespaces (ou similaire) où le frontend et
  // le backend sont servis depuis le même domaine
  if (window.location.hostname.includes('.app.github.dev') ||
      window.location.hostname.includes('.preview.app.github.dev')) {
    const url = `${window.location.origin}/api`;
    console.log('Using GitHub Codespaces API URL:', url);
    return url;
  }

  // Fallback sur localhost pour le développement local
  // Changed to port 5002 to match the updated backend server
  const url = 'http://localhost:5002/api';
  console.log('Using default API URL:', url);
  return url;
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  constructor() {
    // Generate a unique client ID that persists across page refreshes
    this.clientId = localStorage.getItem('clientId') || this.generateClientId();
    localStorage.setItem('clientId', this.clientId);

    // Initialize controllers to null
    this.currentStreamController = null;
    this.currentNonStreamingController = null;

    // Flag to prevent multiple simultaneous cancellation calls
    this._isCanceling = false;
    this._cancelingTimeout = null;

    // Add cooldown for connection attempts to prevent loops
    this._lastConnectionAttempt = 0;
    this._connectionCooldown = 2000; // 2 seconds cooldown
    this._connectionAttemptCount = 0;
    this._maxConsecutiveAttempts = 3;

    // Track if we're in a refresh state to prevent auto-refresh loops
    this._isRefreshing = false;

    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': this.clientId,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-No-Refresh': 'true'
      },
      maxRedirects: 0, // Prevent redirects globally
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Only accept 2xx status codes
      }
    });

    // Intercepteur pour gérer les erreurs globalement
    this.client.interceptors.response.use(
      response => response,
      error => {
        // Don't log cancellation errors to avoid console spam
        if (error.name !== 'CanceledError' && error.name !== 'AbortError' &&
            error.code !== 'ERR_CANCELED' && !error.message?.includes('cancel')) {
          console.error('API Error:', error.response || error);
        }
        return Promise.reject(error);
      }
    );

    // Removed visibility change listener to prevent refresh issues
  }

  // Removed visibility change handler to prevent refresh issues

  // Generate a unique client ID
  generateClientId() {
    return 'client_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
    try {
      // Add a timestamp to prevent caching issues
      const timestamp = Date.now();
      const response = await this.client.get(`/status?_=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-No-Refresh': 'true',
          'X-Timestamp': timestamp.toString()
        }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching system status:", error);
      // Return a default status object to prevent UI from breaking
      return {
        status: "error",
        version: "1.0.0",
        error: error.message || "Failed to fetch system status"
      };
    }
  }

  // === Chat API ===

  // Envoyer une requête au serveur (pour le chat)
  async sendQuery(message, options = {}) {
    try {
      // Check if we should use streaming or not
      const useStreaming = options.useStreaming !== undefined ? options.useStreaming : true;

      // Save the streaming state to localStorage for resumption after refresh
      if (useStreaming) {
        localStorage.setItem('lastStreamingQuery', JSON.stringify({
          message,
          options: {
            useWebSearch: options.useWebSearch
          },
          timestamp: Date.now()
        }));
      }

      // Use streaming by default, but allow it to be disabled
      if (useStreaming) {
        return await this.sendStreamingQuery(message, options);
      } else {
        return await this.sendNonStreamingQuery(message, options);
      }
    } catch (error) {
      console.error("Error in sendQuery:", error);
      return { error: true, message: "Une erreur s'est produite lors de la communication avec le serveur" };
    }
  }

  // Envoyer une requête au serveur sans streaming (pour le chat)
  async sendNonStreamingQuery(message, options = {}) {
    // Create a new AbortController for timeout handling
    const controller = new AbortController();
    const { signal } = controller;

    // Store the controller in the instance to allow cancellation
    this.currentNonStreamingController = controller;

    // Set a longer timeout (5 minutes)
    this._timeoutId = setTimeout(() => controller.abort(), 300000);

    // Initialize progress interval in the instance so it's accessible in cancelStreaming
    this._progressInterval = null;

    try {
      // Removed console.log to prevent console spam

      // Start progress updates
      let progressCounter = 0;
      this._progressInterval = setInterval(() => {
        progressCounter += 1;
        if (options.onProgress) {
          options.onProgress(progressCounter);
        }

        // Also update thinking to show progress
        if (options.onThinking) {
          const thinkingUpdate = `Processing your request... (${progressCounter}s)`;
          options.onThinking(thinkingUpdate);
        }

        // Update content to show it's still processing
        if (options.onChunk && progressCounter % 5 === 0) {
          options.onChunk(".", "Processing your request... Please wait.");
        }
      }, 1000);

      // Configure axios with longer timeout and signal
      const response = await this.client.post('/query/nostream', {
        query: message,
        useWebSearch: options.useWebSearch !== undefined ? options.useWebSearch : true,
        clientId: this.clientId,
        preventRefresh: true, // Additional flag to prevent refresh
        timestamp: Date.now() // Add timestamp to prevent caching
      }, {
        timeout: 300000, // 5 minutes
        signal: signal,
        // Add headers to prevent caching and refreshes
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-No-Refresh': 'true',
          'X-Requested-With': 'XMLHttpRequest', // Add AJAX header
          'X-Timestamp': Date.now().toString() // Add timestamp to prevent caching
        },
        // Prevent redirects that might cause refreshes
        maxRedirects: 0,
        // Prevent browser from following redirects
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only accept 2xx status codes
        }
      });

      // Clear the progress interval and timeout
      if (this._progressInterval) {
        clearInterval(this._progressInterval);
        this._progressInterval = null;
      }

      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }

      // Call callbacks if provided
      if (options.onThinking && response.data.thinking) {
        options.onThinking(response.data.thinking);
      }

      if (options.onDone) {
        options.onDone(response.data);
      }

      return response.data;
    } catch (error) {
      // Check if this is a cancellation error
      const isCancellationError =
        error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.message === 'canceled' ||
        error.code === 'ERR_CANCELED' ||
        (error.message && (
          error.message.includes('cancel') ||
          error.message.includes('abort')
        ));

      if (isCancellationError) {
        console.log('Request was cancelled, retrying automatically...');

        // Instead of returning a cancellation error, try to retry the request
        // This prevents the "La requête a été annulée" message from appearing
        try {
          // Small delay before retrying
          await new Promise(resolve => setTimeout(resolve, 500));

          // Create a new controller for the retry
          this.currentNonStreamingController = new AbortController();
          const { signal } = this.currentNonStreamingController;

          // Retry the request with the same parameters
          const response = await this.client.post('/query/nostream', {
            query: message,
            useWebSearch: options.useWebSearch !== undefined ? options.useWebSearch : true,
            clientId: this.clientId,
            preventRefresh: true,
            timestamp: Date.now()
          }, {
            timeout: 300000,
            signal: signal,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-No-Refresh': 'true',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Timestamp': Date.now().toString()
            }
          });

          // Process the response as normal
          if (options.onThinking && response.data.thinking) {
            options.onThinking(response.data.thinking);
          }

          if (options.onDone) {
            options.onDone(response.data);
          }

          return response.data;
        } catch (retryError) {
          // If retry also fails, return a more helpful error
          console.error("Retry also failed:", retryError);

          // Call error callback if provided
          if (options.onError) {
            options.onError(retryError);
          }

          return {
            error: true,
            message: "Impossible de traiter votre demande. Veuillez réessayer."
          };
        }
      } else {
        // For other errors, pass them through
        console.error("API Error:", error);

        if (options.onError) {
          options.onError(error);
        }

        // Return error object instead of throwing
        return {
          error: true,
          message: error.message || "Une erreur s'est produite lors de la communication avec le serveur"
        };
      }
    } finally {
      // Clean up
      if (this._progressInterval) {
        clearInterval(this._progressInterval);
        this._progressInterval = null;
      }

      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }

      this.currentNonStreamingController = null;
    }
  }

  // Cancel the current non-streaming request
  cancelNonStreamingQuery() {
    if (this.currentNonStreamingController) {
      this.currentNonStreamingController.abort();
      this.currentNonStreamingController = null;
    }
  }

  // Envoyer une requête au serveur avec streaming (pour le chat)
  async sendStreamingQuery(message, options = {}) {
    return new Promise((resolve, reject) => {
      // Check if there's already an active streaming request
      if (this.currentStreamController) {
        console.log("There's already an active streaming request. Canceling it first.");
        this.cancelStreaming(true);

        // Small delay to ensure cleanup is complete
        return setTimeout(() => {
          this.sendStreamingQuery(message, options)
            .then(resolve)
            .catch(reject);
        }, 500);
      }

      // Check if we're in a cooldown period to prevent connection loops
      const now = Date.now();
      const timeSinceLastAttempt = now - this._lastConnectionAttempt;

      if (timeSinceLastAttempt < this._connectionCooldown) {
        console.log(`Connection attempt too soon (${Math.round(timeSinceLastAttempt)}ms < ${this._connectionCooldown}ms cooldown). Waiting...`);

        // If we've had too many consecutive attempts, return an error
        if (this._connectionAttemptCount >= this._maxConsecutiveAttempts) {
          console.error(`Too many consecutive connection attempts (${this._connectionAttemptCount}). Aborting to prevent loops.`);

          const loopError = new Error("Trop de tentatives de connexion consécutives. Veuillez réessayer plus tard.");
          loopError.isLoopError = true;

          // Reset the counter after a while
          setTimeout(() => {
            this._connectionAttemptCount = 0;
          }, 5000);

          return reject(loopError);
        }

        // Wait for the cooldown period before attempting again
        setTimeout(() => {
          this._lastConnectionAttempt = Date.now();
          this._connectionAttemptCount++;
          this.sendStreamingQuery(message, options)
            .then(resolve)
            .catch(reject);
        }, this._connectionCooldown - timeSinceLastAttempt);

        return;
      }

      // Update the last attempt time and reset counter if it's been a while
      this._lastConnectionAttempt = now;
      if (timeSinceLastAttempt > 10000) { // If it's been more than 10 seconds, reset the counter
        this._connectionAttemptCount = 0;
      }
      this._connectionAttemptCount++;

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
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache', // Additional cache control
          'X-Client-ID': this.clientId, // Include client ID for reconnection
          'X-No-Refresh': 'true' // Custom header to indicate no refresh
        },
        body: JSON.stringify({
          query: message,
          useWebSearch: options.useWebSearch !== undefined ? options.useWebSearch : true,
          useStreaming: true,
          clientId: this.clientId, // Also include in the body for redundancy
          preventRefresh: true // Additional flag to prevent refresh
        }),
        signal,
        // Prevent automatic page refresh on connection issues
        keepalive: true,
        // Increase timeout
        timeout: 120000, // 2 minutes
        // Disable automatic refresh
        redirect: 'manual',
        mode: 'cors',
        credentials: 'same-origin'
      };

      // Set a maximum time for the streaming response
      const MAX_STREAMING_TIME = 180000; // 3 minutes
      let streamingTimeout = null;

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

      // Set up a heartbeat to detect if the connection is still alive
      let lastActivityTimestamp = Date.now();
      let lastResponseLength = 0;
      const HEARTBEAT_INTERVAL = 5000; // 5 seconds
      const MAX_INACTIVITY_TIME = 30000; // 30 seconds
      const MAX_STALLED_TIME = 60000; // 60 seconds

      const heartbeatInterval = setInterval(() => {
        const now = Date.now();
        const inactivityTime = now - lastActivityTimestamp;
        const isResponseGrowing = responseData.response.length > lastResponseLength;

        // Update the last response length
        lastResponseLength = responseData.response.length;

        // If we have a response and it's growing, update the activity timestamp
        if (responseData.response && isResponseGrowing) {
          lastActivityTimestamp = now;
        }

        // Check if we've been inactive for too long
        if (inactivityTime > MAX_INACTIVITY_TIME) {
          console.log(`No activity detected for ${MAX_INACTIVITY_TIME/1000} seconds. Connection may be stalled.`);

          // If we have a response, check if it's been stalled for too long
          if (responseData.response) {
            if (inactivityTime > MAX_STALLED_TIME) {
              console.log(`Connection stalled for ${MAX_STALLED_TIME/1000} seconds. Forcing completion.`);

              // Add a note that the response was forced to complete
              responseData.response += "\n\n---\n\n*La réponse a été complétée automatiquement après une période d'inactivité.*";
              responseData.forcedCompletion = true;

              try {
                if (typeof onDone === 'function') {
                  onDone(responseData);
                }
              } catch (callbackError) {
                console.error('Error in onDone callback:', callbackError);
              }

              // Clean up and resolve
              clearInterval(heartbeatInterval);
              cleanup();
              resolve(responseData);

              // Cancel the streaming request
              if (controller) {
                controller.abort();
              }
            } else {
              // If we have a response but it's not been stalled for too long, just log
              console.log(`Connection stalled but waiting (${Math.round(inactivityTime/1000)}s / ${MAX_STALLED_TIME/1000}s)`);
            }
          }
        }
      }, HEARTBEAT_INTERVAL);

      // Initialize callback functions
      const onChunk = options.onChunk || (() => {});
      const onThinking = options.onThinking || (() => {});
      const onDone = options.onDone || (() => {});
      const onError = options.onError || (() => {});

      // Add event listener to prevent page refresh on beforeunload
      const handleBeforeUnload = (event) => {
        // Cancel the event
        event.preventDefault();
        // Chrome requires returnValue to be set
        event.returnValue = '';

        // Try to gracefully close the connection
        if (this.currentStreamController) {
          this.currentStreamController.abort();
        }

        return 'Are you sure you want to leave? Your conversation will be interrupted.';
      };

      // Add the event listener
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Function to clean up event listeners and timeouts
      const cleanup = () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);

        // Clear the streaming timeout if it exists
        if (streamingTimeout) {
          clearTimeout(streamingTimeout);
          streamingTimeout = null;
        }

        // Clear the heartbeat interval
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      };

      // Set a timeout to force completion if the backend doesn't send a 'done' signal
      streamingTimeout = setTimeout(() => {
        console.log(`Streaming timeout reached after ${MAX_STREAMING_TIME/1000} seconds. Forcing completion.`);

        // If we have a response, consider it complete
        if (responseData.response) {
          console.log('Forcing completion with partial response');

          // Add a note that the response was forced to complete
          responseData.response += "\n\n---\n\n*La réponse a été complétée automatiquement après un délai d'attente.*";
          responseData.forcedCompletion = true;

          try {
            if (typeof onDone === 'function') {
              onDone(responseData);
            }
          } catch (callbackError) {
            console.error('Error in onDone callback:', callbackError);
          }

          cleanup();
          resolve(responseData);
        } else {
          // If we don't have a response, treat it as an error
          const timeoutError = new Error("La requête a pris trop de temps");
          timeoutError.isTimeout = true;

          try {
            if (typeof onError === 'function') {
              onError(timeoutError);
            }
          } catch (callbackError) {
            console.error('Error in onError callback:', callbackError);
          }

          cleanup();
          reject(timeoutError);
        }

        // Cancel the streaming request
        if (controller) {
          controller.abort();
        }
      }, MAX_STREAMING_TIME);

      // Make the fetch request with retry logic
      const attemptFetch = (retryCount = 0, maxRetries = 3) => {
        // Don't log for retry attempts to reduce console spam
        if (retryCount === 0) {
          console.log(`Attempting streaming connection (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        } else {
          console.log(`Retrying streaming connection (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        }

        // Check if we're in a cooldown period for retries
        if (retryCount > 0) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
          console.log(`Waiting ${retryDelay}ms before retry...`);
          setTimeout(() => {
            fetch(`${API_BASE_URL}/query/stream`, requestOptions);
          }, retryDelay);
          return;
        }

        fetch(`${API_BASE_URL}/query/stream`, requestOptions)
          .then(response => {
            // Check if the response is a redirect (which might cause a refresh)
            if (response.redirected) {
              console.warn("Received redirect response, but ignoring it to prevent refresh");
              // Create a new response without the redirect
              return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            }

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log("Streaming connection established successfully");

            // Get a reader from the response body
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // Function to read chunks
            const readChunk = () => {
              reader.read().then(({ value, done }) => {
                if (done) {
                  // If we haven't received a 'done' message but the stream is done,
                  // we should still call onDone with what we have
                  if (responseData.response) {
                    console.log("Stream ended without explicit done signal");
                    onDone(responseData);
                    cleanup();
                    resolve(responseData);
                  }
                  return;
                }

                try {
                  // Decode the chunk and add it to our buffer
                  const chunk = decoder.decode(value, { stream: true });
                  buffer += chunk;

                  // Update the activity timestamp
                  lastActivityTimestamp = Date.now();

                  // Process complete JSON objects from the buffer
                  let newlineIndex;
                  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);

                    if (!line) continue;

                    try {
                      const data = JSON.parse(line);

                      // Handle different message types
                      if (data.type === 'metadata') {
                        console.log("Received metadata:", data);
                        responseData.thinking = data.thinking || '';
                        responseData.model = data.model || '';
                        responseData.usedWebSearch = data.usedWebSearch || false;
                        responseData.usedMultiAgent = data.usedMultiAgent || false;

                        // Update the activity timestamp
                        lastActivityTimestamp = Date.now();

                        // Call the thinking callback
                        onThinking(responseData.thinking);
                      }
                      else if (data.type === 'resume') {
                        console.log("Resuming from previous session");
                        // Set the response to the partial response from the server
                        responseData.response = data.content || '';
                        responseData.thinking = data.thinking || responseData.thinking;

                        // Call the callbacks to update the UI
                        onChunk(responseData.response, responseData.response);
                        onThinking(responseData.thinking);

                        console.log("Resumed with content length:", responseData.response.length);
                      }
                      else if (data.type === 'chunk') {
                        // Append the chunk to the response
                        responseData.response += data.content || '';

                        // Update the activity timestamp
                        lastActivityTimestamp = Date.now();

                        // Call the chunk callback with a small delay to simulate natural typing
                        // This creates a more realistic streaming effect like ChatGPT
                        setTimeout(() => {
                          onChunk(data.content, responseData.response);
                        }, Math.random() * 10); // Random small delay between 0-10ms
                      }
                      else if (data.type === 'done') {
                        console.log("Received done signal from server");
                        // Update final response data
                        responseData.response = data.response || responseData.response;
                        responseData.processingTime = data.processingTime || 0;
                        responseData.completed = true;

                        // Update the activity timestamp to prevent false stalled detection
                        lastActivityTimestamp = Date.now();

                        // Set a flag to prevent immediate new requests
                        this._lastConnectionAttempt = Date.now();

                        // Reset the controller to null BEFORE calling onDone
                        // This prevents race conditions where onDone triggers a new request
                        // before we've cleaned up the current one
                        this.currentStreamController = null;

                        try {
                          // Call the done callback
                          if (typeof onDone === 'function') {
                            onDone(responseData);
                          }
                        } catch (callbackError) {
                          console.error('Error in onDone callback:', callbackError);
                        }

                        // Make sure we clean up all resources
                        if (heartbeatInterval) {
                          clearInterval(heartbeatInterval);
                        }

                        if (streamingTimeout) {
                          clearTimeout(streamingTimeout);
                          streamingTimeout = null;
                        }

                        cleanup();
                        resolve(responseData);
                        return;
                      }
                      else if (data.type === 'error') {
                        console.error("Received error from server:", data.message);

                        // Create a standardized error
                        const serverError = new Error(data.message || "Unknown streaming error");
                        serverError.isServerError = true;

                        // Set a flag to prevent immediate new requests
                        this._lastConnectionAttempt = Date.now();

                        // Reset the controller to null BEFORE calling onError
                        // This prevents race conditions where onError triggers a new request
                        // before we've cleaned up the current one
                        this.currentStreamController = null;

                        try {
                          if (typeof onError === 'function') {
                            onError(serverError);
                          }
                        } catch (callbackError) {
                          console.error('Error in onError callback:', callbackError);
                        }

                        // Make sure we clean up all resources
                        if (heartbeatInterval) {
                          clearInterval(heartbeatInterval);
                        }

                        if (streamingTimeout) {
                          clearTimeout(streamingTimeout);
                          streamingTimeout = null;
                        }

                        cleanup();
                        reject(serverError);
                        return;
                      }
                      else if (data.type === 'thinking_update') {
                        // Handle incremental thinking updates
                        responseData.thinking = data.thinking || responseData.thinking;
                        onThinking(responseData.thinking);
                      }
                    } catch (error) {
                      console.warn('Error parsing streaming response line:', error, line);
                      // Continue processing other lines even if one fails
                    }
                  }
                } catch (error) {
                  console.error('Error processing stream chunk:', error);
                }

                // Continue reading
                readChunk();
              }).catch(error => {
                // Check if this is a cancellation error (various browsers/environments use different error properties)
                const isCancellationError =
                  error.name === 'AbortError' ||
                  error.message === 'canceled' ||
                  error.code === 'ERR_CANCELED' ||
                  error.message.includes('aborted') ||
                  error.message.includes('cancel');

                if (isCancellationError) {
                  // Only log if we're not in a refresh state to avoid console spam
                  if (!this._isRefreshing) {
                    console.log('Stream reading aborted by user - handling silently');
                  }

                  // Create a standardized user-friendly error for cancellation
                  const cancelError = new Error("Connexion interrompue, tentative de reconnexion...");
                  cancelError.isCanceled = true;
                  cancelError.name = 'CanceledError'; // Set the name to match axios CanceledError
                  cancelError.code = 'ERR_CANCELED'; // Add code for additional compatibility

                  // If we have a partial response, we can still return it
                  if (responseData.response) {
                    console.log('Returning partial response after cancellation');
                    // Add a note that the response was interrupted
                    responseData.response += "\n\n---\n\n*La requête a été annulée par l'utilisateur.*";
                    responseData.canceled = true; // Mark as canceled

                    try {
                      if (typeof onDone === 'function') {
                        onDone(responseData);
                      }
                    } catch (callbackError) {
                      console.error('Error in onDone callback:', callbackError);
                    }

                    cleanup();
                    resolve(responseData);
                  } else {
                    // Skip calling onError for cancellations to avoid error messages
                    // This prevents the error from showing in the console and UI

                    cleanup();
                    // Resolve with a canceled status instead of rejecting
                    resolve({ canceled: true, message: "Connexion interrompue, tentative de reconnexion..." });
                  }
                } else {
                  console.error('Error reading stream:', error);

                  // If we have a partial response and the connection is lost,
                  // we can still return what we have
                  if (responseData.response && retryCount >= maxRetries) {
                    console.log('Connection lost but returning partial response');

                    try {
                      if (typeof onDone === 'function') {
                        onDone(responseData);
                      }
                    } catch (callbackError) {
                      console.error('Error in onDone callback:', callbackError);
                    }

                    cleanup();
                    resolve(responseData);
                  } else if (retryCount < maxRetries) {
                    // Use exponential backoff for retries
                    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    console.log(`Will retry connection in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})...`);

                    // Update the connection attempt tracking
                    setTimeout(() => {
                      this._lastConnectionAttempt = Date.now();
                      attemptFetch(retryCount + 1, maxRetries);
                    }, retryDelay);
                  } else {
                    try {
                      if (typeof onError === 'function') {
                        onError(error);
                      }
                    } catch (callbackError) {
                      console.error('Error in onError callback:', callbackError);
                    }

                    cleanup();
                    reject(error);
                  }
                }
              });
            };

            // Start reading
            readChunk();
          })
          .catch(error => {
            // Check if this is a cancellation error (various browsers/environments use different error properties)
            const isCancellationError =
              error.name === 'AbortError' ||
              error.message === 'canceled' ||
              error.code === 'ERR_CANCELED' ||
              error.message.includes('aborted') ||
              error.message.includes('cancel');

            if (isCancellationError) {
              // Only log if we're not in a refresh state to avoid console spam
              if (!this._isRefreshing) {
                console.log('Fetch aborted by user - handling silently');
              }

              // Create a standardized user-friendly error for cancellation
              const cancelError = new Error("Connexion interrompue, tentative de reconnexion...");
              cancelError.isCanceled = true;
              cancelError.name = 'CanceledError'; // Set the name to match axios CanceledError
              cancelError.code = 'ERR_CANCELED'; // Add code for additional compatibility

              // Skip calling onError for cancellations to avoid error messages
              // This prevents the error from showing in the console and UI

              // Clean up and resolve with a canceled status instead of rejecting
              cleanup();
              resolve({ canceled: true, message: "Connexion interrompue, tentative de reconnexion..." });
            } else {
              console.error('Error with streaming request:', error);

              if (retryCount < maxRetries) {
                // Use exponential backoff for retries
                const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                console.log(`Will retry connection in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})...`);

                // Update the connection attempt tracking
                setTimeout(() => {
                  this._lastConnectionAttempt = Date.now();
                  attemptFetch(retryCount + 1, maxRetries);
                }, retryDelay);
              } else {
                try {
                  if (typeof onError === 'function') {
                    onError(error);
                  }
                } catch (callbackError) {
                  console.error('Error in onError callback:', callbackError);
                }

                cleanup();
                reject(error);
              }
            }
          });
      };

      // Start the first attempt
      attemptFetch();
    });
  }

  // Check for and resume a streaming query that was interrupted by a refresh
  checkForInterruptedStreaming() {
    try {
      // Check if cancellation was intentional
      const intentionallyCanceled = localStorage.getItem('streamingIntentionallyCanceled') === 'true';
      if (intentionallyCanceled) {
        // If cancellation was intentional, don't resume
        localStorage.removeItem('lastStreamingQuery');
        localStorage.removeItem('streamingIntentionallyCanceled');
        return null;
      }

      const lastStreamingQuery = localStorage.getItem('lastStreamingQuery');
      if (lastStreamingQuery) {
        const queryData = JSON.parse(lastStreamingQuery);

        // Check if the query is recent (within the last 5 minutes)
        const now = Date.now();
        const queryTime = queryData.timestamp || 0;
        const timeSinceQuery = now - queryTime;

        if (timeSinceQuery < 5 * 60 * 1000) { // 5 minutes
          console.log('Found interrupted streaming query from', new Date(queryTime));

          // Add additional metadata to help with resumption
          queryData.wasInterrupted = true;
          queryData.interruptionTime = timeSinceQuery;

          return queryData;
        } else {
          console.log('Found old streaming query, ignoring');
          localStorage.removeItem('lastStreamingQuery');
          return null;
        }
      }
    } catch (error) {
      console.error('Error checking for interrupted streaming:', error);
      localStorage.removeItem('lastStreamingQuery');
      localStorage.removeItem('streamingIntentionallyCanceled');
    }
    return null;
  }

  // Clear the interrupted streaming query data
  clearInterruptedStreaming() {
    localStorage.removeItem('lastStreamingQuery');
  }

  // Cancel the current streaming or non-streaming request
  cancelStreaming(force = false) {
    // Use a flag to track if we're already in the process of canceling
    if (this._isCanceling && !force) {
      return Promise.resolve();
    }

    // Check if there's actually something to cancel
    const hasActiveRequests = this.currentStreamController || this.currentNonStreamingController;

    // If nothing to cancel and not forced, just return
    if (!hasActiveRequests && !force) {
      return Promise.resolve();
    }

    this._isCanceling = true;

    // Create a promise to track cancellation completion
    return new Promise((resolve) => {
      try {
        // Cancel streaming request if active
        if (this.currentStreamController) {
          try {
            this.currentStreamController.abort();
          } catch (error) {
            // Silent catch
          } finally {
            this.currentStreamController = null;
          }
        }

        // Also cancel non-streaming request if active
        if (this.currentNonStreamingController) {
          try {
            this.currentNonStreamingController.abort();
          } catch (error) {
            // Silent catch
          } finally {
            this.currentNonStreamingController = null;
          }
        }

        // Also cancel any progress intervals
        if (this._progressInterval) {
          clearInterval(this._progressInterval);
          this._progressInterval = null;
        }

        // Also cancel any timeouts
        if (this._timeoutId) {
          clearTimeout(this._timeoutId);
          this._timeoutId = null;
        }

        // Clear the interrupted streaming query data if forced
        // Otherwise, keep it for potential resumption
        if (force) {
          this.clearInterruptedStreaming();
        }

        // Set a flag in localStorage to indicate cancellation was intentional
        if (force) {
          try {
            localStorage.setItem('streamingIntentionallyCanceled', 'true');
            // Clear this flag after a short period
            setTimeout(() => {
              localStorage.removeItem('streamingIntentionallyCanceled');
            }, 5000);
          } catch (e) {
            // Silent catch for localStorage errors
          }
        }
      } finally {
        // Reset the canceling flag after a short delay
        // This prevents multiple rapid cancellation calls
        if (this._cancelingTimeout) {
          clearTimeout(this._cancelingTimeout);
        }

        this._cancelingTimeout = setTimeout(() => {
          this._isCanceling = false;
          this._cancelingTimeout = null;
          resolve(); // Resolve the promise after the timeout
        }, 500); // Reduced timeout for faster response
      }
    });
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

  // Clean up resources when the application is closed
  cleanup() {
    // Cancel any active requests
    this.cancelStreaming(true); // Force cancellation

    // No event listeners to remove

    // Clear any pending timeouts
    if (this._cancelingTimeout) {
      clearTimeout(this._cancelingTimeout);
      this._cancelingTimeout = null;
    }

    // Reset connection attempt tracking
    this._lastConnectionAttempt = 0;
    this._connectionAttemptCount = 0;
    this._isRefreshing = false;
  }
}

export default new ApiService();