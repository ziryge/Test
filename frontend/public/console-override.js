/**
 * This script completely overrides the console object to filter out React DevTools messages
 * It must be the first script loaded in the page
 * Enhanced version with more comprehensive filtering and DevTools disabling
 */

(function() {
  // Store the original console methods
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    group: console.group,
    groupCollapsed: console.groupCollapsed,
    groupEnd: console.groupEnd,
    table: console.table,
    count: console.count,
    countReset: console.countReset,
    time: console.time,
    timeLog: console.timeLog,
    timeEnd: console.timeEnd,
    assert: console.assert,
    clear: console.clear,
    dir: console.dir,
    dirxml: console.dirxml,
    profile: console.profile,
    profileEnd: console.profileEnd,
    timeStamp: console.timeStamp
  };

  // Comprehensive list of patterns to filter out
  const reactDevToolsPatterns = [
    'Download the React DevTools',
    'react-devtools',
    'React DevTools',
    'https://reactjs.org/link/react-devtools',
    'better development experience',
    'development mode',
    'development build',
    'production mode',
    'You are running React in development mode',
    'StrictMode is enabled',
    'StrictMode rendering',
    'double-invocation',
    'act(...)',
    'unstable_',
    'Warning: ',
    'Invalid hook call',
    'react-dom.development.js',
    'react.development.js',
    'scheduler.development.js',
    'react-jsx-dev-runtime.development.js',
    'Use the production build',
    'profiling',
    'debugger',
    'debuggingEnabled',
    'DevTools',
    'profiler',
    'Profiler',
    'useDebugValue',
    'useProfiler',
    'A-Frame Version',
    'THREE Version'
  ];

  // Create a more sophisticated filter function
  const shouldFilter = function(args) {
    if (!args || args.length === 0) return false;

    // Check each argument
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Check strings
      if (typeof arg === 'string') {
        if (reactDevToolsPatterns.some(pattern => arg.includes(pattern))) {
          return true;
        }
      }

      // Check objects (including Error objects)
      if (typeof arg === 'object' && arg !== null) {
        // Check Error objects specifically
        if (arg instanceof Error && arg.message) {
          if (reactDevToolsPatterns.some(pattern => arg.message.includes(pattern))) {
            return true;
          }

          // Also check the stack trace
          if (arg.stack && reactDevToolsPatterns.some(pattern => arg.stack.includes(pattern))) {
            return true;
          }
        }

        // Try to stringify other objects
        try {
          const stringified = JSON.stringify(arg);
          if (reactDevToolsPatterns.some(pattern => stringified.includes(pattern))) {
            return true;
          }
        } catch (e) {
          // Ignore errors in stringification

          // For non-stringifiable objects, check their properties
          try {
            for (const key in arg) {
              if (Object.prototype.hasOwnProperty.call(arg, key)) {
                const value = arg[key];
                if (typeof value === 'string' &&
                    reactDevToolsPatterns.some(pattern => value.includes(pattern))) {
                  return true;
                }
              }
            }
          } catch (e2) {
            // Ignore errors in property access
          }
        }
      }
    }

    return false;
  };

  // Function to create overridden console methods
  const createOverriddenMethod = function(method) {
    return function(...args) {
      // Skip filtering for empty calls
      if (args.length === 0) {
        return originalConsole[method].apply(console, args);
      }

      // Filter out React DevTools messages
      if (!shouldFilter(args)) {
        return originalConsole[method].apply(console, args);
      }

      // Return a dummy value for methods that might be expected to return something
      if (method === 'time' || method === 'timeLog' || method === 'timeEnd') {
        return undefined;
      }
    };
  };

  // Override all console methods
  for (const method in originalConsole) {
    if (Object.prototype.hasOwnProperty.call(originalConsole, method)) {
      console[method] = createOverriddenMethod(method);
    }
  }

  // Helper function to check if we're in development mode
  const isDevMode = function() {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  };

  // Disable React DevTools with a more compatible approach
  if (typeof window !== 'undefined') {
    try {
      // Set flags to indicate DevTools should be disabled
      window.__REACT_DEVTOOLS_DISABLED__ = true;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK_DISABLED__ = true;

      // Create a non-functional hook object that's compatible with HMR
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
        _listeners: {},
        addListener: () => {},
        removeListener: () => {},
        emit: () => {}
      };

      // In development mode, don't freeze the hook to allow HMR to work
      const hookToUse = isDevMode() ? disabledHook : Object.freeze(disabledHook);

      // Only set the hook if it doesn't exist yet (to avoid conflicts with HMR)
      if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hookToUse;
      }

      // In production mode, apply more aggressive blocking
      if (!isDevMode()) {
        // Disable the extension communication channel
        window.__REACT_DEVTOOLS_EXTENSION__ = undefined;
        Object.defineProperty(window, '__REACT_DEVTOOLS_EXTENSION__', {
          configurable: false,
          enumerable: false,
          get: function() { return undefined; },
          set: function() {}
        });

        // Disable browser extension detection
        window.__REACT_DEVTOOLS_BROWSER_EXTENSION__ = false;
        Object.defineProperty(window, '__REACT_DEVTOOLS_BROWSER_EXTENSION__', {
          configurable: false,
          enumerable: false,
          get: function() { return false; },
          set: function() {}
        });

        // Disable development mode
        window.__DEV__ = false;
        Object.defineProperty(window, '__DEV__', {
          configurable: false,
          enumerable: false,
          get: function() { return false; },
          set: function() {}
        });

        // Set production mode
        window.process = window.process || {};
        window.process.env = window.process.env || {};
        window.process.env.NODE_ENV = 'production';
        Object.defineProperty(window.process.env, 'NODE_ENV', {
          configurable: false,
          enumerable: true,
          get: function() { return 'production'; },
          set: function() {}
        });
      }
    } catch (e) {
      // Silently fail
    }
  }

  // Also prevent React DevTools from connecting via WebSocket in production mode
  try {
    // Only apply WebSocket blocking in production mode
    if (!isDevMode()) {
      // Store the original WebSocket constructor
      const OriginalWebSocket = window.WebSocket;

      // Override WebSocket to prevent connections to React DevTools
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
    }
  } catch (e) {
    // Silently fail
  }
})();
