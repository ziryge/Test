// Import disableDevTools first to ensure it runs before React
import disableDevTools from './disableDevTools';
disableDevTools();

// Then import React and other dependencies
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import './assets/styles/index.scss';

// Import and initialize the NoRefreshMiddleware to prevent automatic refreshes
import { initNoRefreshMiddleware } from './services/NoRefreshMiddleware';
initNoRefreshMiddleware();

// Configure future flags to remove warnings
const router = {
  basename: "/",
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
};

// Disable React StrictMode to prevent double mounting in development
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter
    basename={router.basename}
    future={router.future}
  >
    <ThemeProvider>
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <App />
      </SnackbarProvider>
    </ThemeProvider>
  </BrowserRouter>
);