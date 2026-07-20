import { NavLink, Route, Routes } from 'react-router-dom'
import { BrowserPage } from './pages/BrowserPage'
import { DocsPage } from './pages/DocsPage'
import { ReleasesPage } from './pages/ReleasesPage'
import { packagesUrl } from './lib/github'

const packageVersion = import.meta.env.VITE_PACKAGE_VERSION

/** Full icon browser (not used inside the Figma plugin panel). */
export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>GenVoice Icons</strong>
            <p>Brand icons for React &amp; Vue</p>
          </div>
        </div>
        <div className="topbar-end">
          <a
            className="package-version"
            href={packagesUrl()}
            target="_blank"
            rel="noreferrer"
            title="GitHub Packages (linked package set)"
          >
            v{packageVersion}
          </a>
          <nav className="nav">
            <NavLink to="/" end>
              Browse
            </NavLink>
            <NavLink to="/docs">Docs</NavLink>
            <NavLink to="/releases">Releases</NavLink>
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<BrowserPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/releases" element={<ReleasesPage />} />
        </Routes>
      </main>
    </div>
  )
}
