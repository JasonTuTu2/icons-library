import { NavLink, Route, Routes } from 'react-router-dom'
import { BrowserPage } from './pages/BrowserPage'
import { DocsPage } from './pages/DocsPage'

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>GenVoice Icons</strong>
            <p>Ant Design + Iconify for React &amp; Vue</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Browse
          </NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<BrowserPage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </main>
    </div>
  )
}
