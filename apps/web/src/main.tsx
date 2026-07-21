import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { consumeFigmaHandoffFromUrl } from './lib/figmaHandoff'
import { consumeStagingHandoffFromUrl, retryPendingStagingHandoffImport } from './lib/stagingHandoff'
import { consumeGithubTokenFromUrl } from './lib/githubAuth'
import { consumeAuthSessionFromUrl } from './lib/sessionAuth'
import './styles.css'

async function bootstrap(): Promise<void> {
  consumeGithubTokenFromUrl()
  consumeAuthSessionFromUrl()
  consumeFigmaHandoffFromUrl()
  await consumeStagingHandoffFromUrl()
  await retryPendingStagingHandoffImport()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrap()
