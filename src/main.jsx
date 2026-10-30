import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { restoreLastLanguage } from './i18n.js'
import { ensureProfiles } from './data/profiles.js'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

// Before the first screen: the last language used, and the active patient's database
Promise.allSettled([restoreLastLanguage(), ensureProfiles()]).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})
