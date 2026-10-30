import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { restoreLastLanguage } from './i18n.js'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

restoreLastLanguage().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})
