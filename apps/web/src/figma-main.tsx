import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FigmaDock } from './components/FigmaDock'
import './styles.css'

/**
 * Dedicated Figma plugin panel entry — Load + Stage only.
 * Never mounts the icon browser / catalog UI.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FigmaDock />
  </StrictMode>,
)
