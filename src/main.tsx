
import { createRoot } from 'react-dom/client'
import React from 'react' // Explicitly import React
import App from './app/AppEntry'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'
import { installChunkLoadRecovery } from '@/lib/chunkLoadRecovery'
import { installImageContextMenuGuard } from '@/lib/imageContextMenuGuard'

// Fonts are bundled locally in their own CSS chunk, avoiding third-party CSP
// requests without consuming the main stylesheet's strict size allowance.
void import('./fonts.css')

// Make sure we have a DOM node to render to
const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element not found")
}

installChunkLoadRecovery()
installImageContextMenuGuard()

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <React.Suspense fallback={<div role="status" className="min-h-screen grid place-items-center">Loading…</div>}>
        <App />
      </React.Suspense>
    </ThemeProvider>
  </React.StrictMode>
);
