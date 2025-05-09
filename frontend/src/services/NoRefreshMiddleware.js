/**
 * NoRefreshMiddleware.js
 *
 * This middleware intercepts all fetch and XMLHttpRequest calls to prevent
 * automatic page refreshes that might be triggered by the server.
 * It also ensures proper cleanup of streaming requests when the page is refreshed.
 */

// Import ApiService to cancel streaming on page refresh
import ApiService from './ApiService';

// Store the original fetch function
const originalFetch = window.fetch;

// Override the fetch function with our custom implementation
window.fetch = function(url, options = {}) {
  // Add headers to prevent caching and refreshes
  const newOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-No-Refresh': 'true',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Timestamp': Date.now().toString()
    },
    // Prevent automatic redirects
    redirect: 'manual',
    // Add a cache-busting query parameter
    cache: 'no-store'
  };

  // If the URL is a string, add a cache-busting query parameter
  if (typeof url === 'string') {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}_=${Date.now()}`;
  }

  // Call the original fetch with our modified options
  return originalFetch(url, newOptions)
    .then(response => {
      // Check if the response is a redirect
      if (response.type === 'opaqueredirect' || response.redirected) {
        // Create a new response without the redirect
        return new Response(response.body, {
          status: 200,
          statusText: 'OK',
          headers: response.headers
        });
      }

      return response;
    })
    .catch(error => {
      throw error;
    });
};

// Store the original XMLHttpRequest open method
const originalXhrOpen = XMLHttpRequest.prototype.open;

// Override the XMLHttpRequest open method
XMLHttpRequest.prototype.open = function(method, url, async = true, user, password) {
  // Add a cache-busting query parameter
  if (typeof url === 'string') {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}_=${Date.now()}`;
  }

  // Call the original open method with our modified URL
  return originalXhrOpen.call(this, method, url, async, user, password);
};

// Store the original XMLHttpRequest send method
const originalXhrSend = XMLHttpRequest.prototype.send;

// Override the XMLHttpRequest send method
XMLHttpRequest.prototype.send = function(body) {
  // Add headers to prevent caching and refreshes
  this.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  this.setRequestHeader('Pragma', 'no-cache');
  this.setRequestHeader('Expires', '0');
  this.setRequestHeader('X-No-Refresh', 'true');
  this.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  this.setRequestHeader('X-Timestamp', Date.now().toString());

  // Call the original send method
  return originalXhrSend.call(this, body);
};

// Flag to track if we're in the process of refreshing
let isRefreshing = false;

// Prevent automatic page refreshes and ensure proper cleanup
window.addEventListener('beforeunload', function(event) {
  // Only prevent unload if it's not explicitly triggered by the user
  if (!window._userInitiatedUnload) {
    // Cancel any ongoing streaming requests to prevent them from continuing after refresh
    if (ApiService && typeof ApiService.cancelStreaming === 'function') {
      try {
        ApiService.cancelStreaming(true);
      } catch (e) {
        // Silent catch to prevent errors during page unload
      }
    }

    // Set the refreshing flag
    isRefreshing = true;

    // Modern approach to handle beforeunload
    if (event) {
      event.preventDefault();

      // For older browsers that require returnValue
      // This is still needed for compatibility
      const message = 'Are you sure you want to leave? Your conversation will be interrupted.';
      event.returnValue = message;
      return message;
    }
  }
});

// Prevent F5 key from refreshing the page
window.addEventListener('keydown', function(event) {
  // F5 key or Ctrl+R
  if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
    event.preventDefault();

    // Cancel any ongoing streaming requests
    if (ApiService && typeof ApiService.cancelStreaming === 'function') {
      try {
        ApiService.cancelStreaming(true);
      } catch (e) {
        // Silent catch to prevent errors
      }
    }

    // Show a message to the user
    if (!window._refreshBlockedMessage) {
      window._refreshBlockedMessage = true;
      const message = document.createElement('div');
      message.style.position = 'fixed';
      message.style.top = '10px';
      message.style.left = '50%';
      message.style.transform = 'translateX(-50%)';
      message.style.padding = '10px 20px';
      message.style.backgroundColor = '#333';
      message.style.color = '#fff';
      message.style.borderRadius = '5px';
      message.style.zIndex = '9999';
      message.style.textContent = 'Rafraîchissement de page bloqué pour éviter l\'interruption de la conversation';
      document.body.appendChild(message);

      // Remove the message after 3 seconds
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
        window._refreshBlockedMessage = false;
      }, 3000);
    }

    return false;
  }
});

// Function to safely refresh the page (user-initiated)
export function safeRefresh() {
  // Set a flag to indicate that this refresh is user-initiated
  window._userInitiatedUnload = true;

  // Cancel any ongoing streaming requests before refreshing
  if (ApiService && typeof ApiService.cancelStreaming === 'function') {
    try {
      ApiService.cancelStreaming(true);

      // Small delay to ensure cancellation completes before refresh
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (e) {
      // If cancellation fails, still refresh the page
      window.location.reload();
    }
  } else {
    // If ApiService is not available, just refresh
    window.location.reload();
  }
}

// Export a function to initialize the middleware
export function initNoRefreshMiddleware() {
  // Set up visibility change detection to handle tab switching
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // When tab becomes visible again, check if we need to resume any interrupted requests
      if (ApiService && typeof ApiService.checkForInterruptedStreaming === 'function') {
        const interruptedQuery = ApiService.checkForInterruptedStreaming();
        if (interruptedQuery) {
          // The Chat component will handle resuming the query when it mounts
          console.log('Detected interrupted query that will be resumed');
        }
      }
    } else if (document.visibilityState === 'hidden') {
      // When tab is hidden, we don't need to do anything special
      // The streaming will continue in the background
    }
  });

  // Initialize with refreshing flag set to false
  isRefreshing = false;
}

// Check if we're refreshing
export function isPageRefreshing() {
  return isRefreshing;
}

export default {
  initNoRefreshMiddleware,
  safeRefresh,
  isPageRefreshing
};
