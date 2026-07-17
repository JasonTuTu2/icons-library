import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as AntIcons from '@ant-design/icons'
import { registerAntIcons } from '@JasonTuTu2/icons-react'
import { App } from './App'
import { consumeFigmaHandoffFromUrl } from './lib/figmaHandoff'
import { consumeGithubTokenFromUrl } from './lib/githubAuth'
import './styles.css'

consumeGithubTokenFromUrl()

registerAntIcons(AntIcons as never)

async function boot(): Promise<void> {
  await consumeFigmaHandoffFromUrl()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void boot()
