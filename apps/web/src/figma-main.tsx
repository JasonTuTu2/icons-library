import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/AuthGate'
import { FigmaDock } from './components/FigmaDock'
import { consumeAuthSessionFromUrl } from './lib/sessionAuth'
import './styles.css'

consumeAuthSessionFromUrl()

/**
 * Dedicated Figma plugin panel entry — Load + Stage only.
 * Never mounts the icon browser / catalog UI.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate compact>
      <FigmaDock />
    </AuthGate>
  </StrictMode>,
)
