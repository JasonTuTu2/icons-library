import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as AntIcons from '@ant-design/icons'
import { registerCustomIcons } from '@JasonTuTu2/icons-custom/react'
import { registerAntIcons } from '@JasonTuTu2/icons-react'
import { App } from './App'
import './styles.css'

registerAntIcons(AntIcons as never)
registerCustomIcons()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
