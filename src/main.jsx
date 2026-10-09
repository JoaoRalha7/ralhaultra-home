import './styles/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';

// After a new deploy, an open tab may ask for a page chunk that no longer exists: reload once to pick up the new build.
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('chunk-reload')) return;
    sessionStorage.setItem('chunk-reload', '1');
  } catch { /* ignore */ }
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
