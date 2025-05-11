import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiService from '../services/ApiService';

// Create context
const BrowserContext = createContext();

// Custom hook to use the browser context
export const useBrowserContext = () => useContext(BrowserContext);

// Provider component
export const BrowserProvider = ({ children }) => {
  const [activeBrowsers, setActiveBrowsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  // Fetch active browsers
  const fetchActiveBrowsers = async () => {
    try {
      const response = await ApiService.listBrowsers();
      if (response && response.browsers) {
        setActiveBrowsers(response.browsers);
      }
    } catch (err) {
      console.error('Error fetching active browsers:', err);
      // Don't set error here to avoid UI disruption during background polling
    }
  };

  // Open a new browser
  const openBrowser = async (url) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ApiService.openBrowser(url);
      await fetchActiveBrowsers(); // Refresh the list
      return response;
    } catch (err) {
      console.error('Error opening browser:', err);
      setError('Failed to open browser. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Navigate to a URL in an existing browser
  const navigateBrowser = async (browserId, url) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ApiService.navigateBrowser(browserId, url);
      await fetchActiveBrowsers(); // Refresh the list
      return response;
    } catch (err) {
      console.error('Error navigating browser:', err);
      setError('Failed to navigate browser. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Close a browser
  const closeBrowser = async (browserId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await ApiService.closeBrowser(browserId);
      await fetchActiveBrowsers(); // Refresh the list
      return response;
    } catch (err) {
      console.error('Error closing browser:', err);
      setError('Failed to close browser. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Set up polling for active browsers
  useEffect(() => {
    // Initial fetch
    fetchActiveBrowsers();
    
    // Set up polling
    const intervalId = setInterval(fetchActiveBrowsers, refreshInterval);
    
    // Clean up
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Context value
  const contextValue = {
    activeBrowsers,
    loading,
    error,
    openBrowser,
    navigateBrowser,
    closeBrowser,
    refreshBrowsers: fetchActiveBrowsers,
    setRefreshInterval,
  };

  return (
    <BrowserContext.Provider value={contextValue}>
      {children}
    </BrowserContext.Provider>
  );
};

export default BrowserContext;
