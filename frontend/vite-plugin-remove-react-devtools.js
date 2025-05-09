/**
 * Vite plugin to remove React DevTools messages from the React source code
 * Enhanced version with more comprehensive pattern matching and complete DevTools disabling
 */

export default function removeReactDevToolsPlugin() {
  return {
    name: 'vite-plugin-remove-react-devtools',
    transform(code, id) {
      // Only transform React-related files
      if (id.includes('node_modules/react') ||
          id.includes('node_modules/react-dom') ||
          id.includes('node_modules/scheduler')) {

        // Remove the DevTools message
        let newCode = code;

        // More comprehensive pattern for the DevTools messages in React
        const devToolsPatterns = [
          // Standard DevTools download message
          /console\.(log|warn|error|info|debug)\s*\(\s*(['"])Download the React DevTools[^)]*\)/g,

          // Any console message containing "React DevTools"
          /console\.(log|warn|error|info|debug)\s*\(\s*(['"])[^\2]*React DevTools[^\2]*\2[^)]*\)/g,

          // Any console message about development experience
          /console\.(log|warn|error|info|debug)\s*\(\s*(['"])[^\2]*development experience[^\2]*\2[^)]*\)/g,

          // Any console message with the URL to React DevTools
          /console\.(log|warn|error|info|debug)\s*\(\s*(['"])[^\2]*reactjs\.org\/link\/react-devtools[^\2]*\2[^)]*\)/g
        ];

        // Apply all patterns
        devToolsPatterns.forEach(pattern => {
          newCode = newCode.replace(pattern, '(() => {})()');
        });

        // Pattern for any reference to DevTools
        const devToolsRefPattern = /\b(React)?DevTools\b/g;
        newCode = newCode.replace(devToolsRefPattern, 'DisabledDevTools');

        // Disable the DevTools hook completely
        const hookPattern = /__REACT_DEVTOOLS_GLOBAL_HOOK__/g;
        newCode = newCode.replace(hookPattern, '__REACT_DEVTOOLS_GLOBAL_HOOK_DISABLED__');

        // Disable any checks for DevTools presence
        const checkPattern = /typeof\s+__REACT_DEVTOOLS_GLOBAL_HOOK__\s*!==?\s*(['"])undefined\1/g;
        newCode = newCode.replace(checkPattern, 'false');

        // Disable any code that tries to connect to DevTools
        const connectPattern = /connectToDevTools/g;
        newCode = newCode.replace(connectPattern, 'doNotConnectToDevTools');

        return {
          code: newCode,
          map: null
        };
      }

      return null;
    }
  };
}
