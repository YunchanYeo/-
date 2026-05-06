import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './index.css';

function isElectron() {
  return (
    typeof window !== 'undefined' &&
    // preload 에서 window.platform.isElectron 주입
    !!(window as any)?.platform?.isElectron
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isElectron() ? (
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
