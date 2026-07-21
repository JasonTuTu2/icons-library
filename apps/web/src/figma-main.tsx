import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/AuthGate'
import { FigmaDock } from './components/FigmaDock'
import { consumeFigmaHostFlag } from './lib/figmaHost'
import { PluginLocaleProvider } from './lib/pluginI18n'
import { consumeAuthSessionFromUrl } from './lib/sessionAuth'
import './styles.css'

consumeAuthSessionFromUrl()
consumeFigmaHostFlag()

/**
 * Dedicated Figma plugin panel entry — Load + Stage only.
 * Never mounts the icon browser / catalog UI.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PluginLocaleProvider>
      <AuthGate compact>
        <FigmaDock />
      </AuthGate>
    </PluginLocaleProvider>
  </StrictMode>,
)
