import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as AntIcons from '@ant-design/icons'
import { registerAntIcons } from '@genvoice/icons-react'
import { App } from './App'
import './styles.css'

registerAntIcons(AntIcons as never)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
