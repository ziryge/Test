/**
 * This script completely disables React DevTools messages in the console
 * It should be included in the index.html before any React code loads
 */

// Completely disable React DevTools
(function() {
  // Define a more aggressive approach to disable React DevTools
  const disableReactDevTools = function() {
    // For React 16+
    if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
      // Make all hook properties non-configurable and non-writable
      for (const prop in window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        if (prop === 'renderers') {
          // This needs special handling
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] = new Map();
        } else {
          try {
            // Replace all methods with no-op functions
            if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] === 'function') {
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] = Function.prototype;
            } else {
              // For non-function properties, just set them to null or empty objects
              window.__REACT_DEVTOOLS_GLOBAL_HOOK__[prop] = null;
            }
          } catch (e) {
            console.warn('Error disabling React DevTools:', e);
          }
        }
      }
    }

    // Set a flag to indicate we've disabled React DevTools
    window.__REACT_DEVTOOLS_DISABLED__ = true;
  };

  // Call the function immediately
  disableReactDevTools();

  // Also call it when the window loads, just to be sure
  if (window.addEventListener) {
    window.addEventListener('load', disableReactDevTools, true);
  }

  // Override console.log to filter out React DevTools messages
  const originalConsoleLog = console.log;

  console.log = function(...args) {
    // Check if this is the React DevTools message
    if (args.length > 0 &&
        typeof args[0] === 'string' &&
        (args[0].includes('Download the React DevTools') ||
         args[0].includes('react-devtools'))) {
      // Ignore this message
      return;
    }

    // Pass through all other messages
    return originalConsoleLog.apply(console, args);
  };
})();
