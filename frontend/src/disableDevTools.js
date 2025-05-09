/**
 * This module disables React DevTools before React is loaded
 * Enhanced version with more comprehensive disabling techniques
 */

// Disable React DevTools
if (typeof window !== 'undefined') {
  try {
    // First, set flags to indicate DevTools should be disabled
    window.__REACT_DEVTOOLS_DISABLED__ = true;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK_DISABLED__ = true;

    // Create a completely non-functional hook object
    const disabledHook = {
      supportsFiber: true,
      inject: () => {},
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
      renderers: new Map(),
      sub: () => {},
      unsub: () => {},
      _renderers: {},
      helpers: {},
      checkDCE: () => {},
      onCommitRoot: () => {},
      onCommitUnmount: () => {},
      // Add any other methods that might be called
      _listeners: {},
      addListener: () => {},
      removeListener: () => {},
      emit: () => {},
      // Ensure any property access returns a no-op function
      get: (target, prop) => typeof target[prop] === 'function' ? () => {} : target[prop]
    };

    // Make the hook object immutable
    const frozenHook = Object.freeze(disabledHook);

    // Check if the property already exists
    if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      // If it doesn't exist, define it with a getter that returns our disabled hook
      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        configurable: false, // Make it non-configurable
        enumerable: true,
        get: function() {
          return frozenHook;
        },
        // Prevent setting a new value
        set: function() {
          return frozenHook;
        }
      });
    } else {
      // If it exists, replace all its methods with no-ops
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

      // Replace all methods with no-ops
      for (const key in frozenHook) {
        if (Object.prototype.hasOwnProperty.call(frozenHook, key)) {
          try {
            hook[key] = frozenHook[key];
          } catch (e) {
            // Silently fail if we can't modify a property
          }
        }
      }

      // Try to make the hook non-writable
      try {
        Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
          configurable: false,
          writable: false,
          value: hook
        });
      } catch (e) {
        // Silently fail if we can't redefine the property
      }
    }

    // Also disable the extension communication channel
    window.__REACT_DEVTOOLS_EXTENSION__ = undefined;
    Object.defineProperty(window, '__REACT_DEVTOOLS_EXTENSION__', {
      configurable: false,
      enumerable: false,
      get: function() { return undefined; },
      set: function() {}
    });
  } catch (e) {
    // Silent catch - we don't want to show any errors
  }

  // Override all console methods to filter out React DevTools messages
  try {
    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];

    consoleMethods.forEach(method => {
      const original = console[method];

      console[method] = function(...args) {
        // Check if this is a React DevTools related message
        if (args.length > 0 && typeof args[0] === 'string') {
          const message = args[0];
          const devToolsPatterns = [
            'Download the React DevTools',
            'react-devtools',
            'React DevTools',
            'development experience',
            'https://reactjs.org/link/react-devtools',
            'extension for React'
          ];

          // Skip the message if it matches any pattern
          if (devToolsPatterns.some(pattern => message.includes(pattern))) {
            return;
          }
        }

        // Pass through all other messages
        return original.apply(console, args);
      };
    });
  } catch (e) {
    // Silent catch - we don't want to show any errors
  }

  // Prevent React DevTools from connecting via WebSocket
  try {
    // Override WebSocket to prevent connections to React DevTools
    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      // Check if this is a connection to React DevTools
      if (url && typeof url === 'string' &&
          (url.includes('react-devtools') || url.includes('localhost:8097'))) {
        // Return a dummy WebSocket that does nothing
        return {
          send: () => {},
          close: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false
        };
      }

      // Otherwise, create a real WebSocket
      return new OriginalWebSocket(url, protocols);
    };

    // Copy properties from the original WebSocket
    for (const prop in OriginalWebSocket) {
      if (Object.prototype.hasOwnProperty.call(OriginalWebSocket, prop)) {
        window.WebSocket[prop] = OriginalWebSocket[prop];
      }
    }
  } catch (e) {
    // Silent catch - we don't want to show any errors
  }
}

export default function disableDevTools() {
  // This function doesn't need to do anything, just importing this module is enough
  return true;
}
