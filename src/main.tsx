
import { createRoot } from 'react-dom/client'
import React from 'react' // Explicitly import React
import '@/services/api' // Register global axios interceptors (auth + impersonation) early
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'
import { installChunkLoadRecovery } from '@/lib/chunkLoadRecovery'

// Make sure we have a DOM node to render to
const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

installChunkLoadRecovery()

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
