import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { BrowserPage } from './pages/BrowserPage'
import { DocsPage } from './pages/DocsPage'
import { InvitePage } from './pages/InvitePage'
import { ReleasesPage } from './pages/ReleasesPage'
import { UsersPage } from './pages/UsersPage'
import { AuthGate } from './components/AuthGate'
import { LoginControl } from './components/LoginControl'
import { packagesUrl } from './lib/github'
import { isAuthApiConfigured, useAuthSession } from './lib/sessionAuth'

const packageVersion = import.meta.env.VITE_PACKAGE_VERSION

function AppShell() {
  const session = useAuthSession()
  const showDocs = true
  const showDevDocs =
    !isAuthApiConfigured() || session?.role === 'dev'
  const showUsers =
    isAuthApiConfigured() && session?.role === 'dev'

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
          <LoginControl />
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
            {showDocs ? (
              <NavLink to="/docs">Docs</NavLink>
            ) : null}
            <NavLink to="/releases">Releases</NavLink>
            {showUsers ? <NavLink to="/users">Accounts</NavLink> : null}
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<BrowserPage />} />
          <Route
            path="/docs"
            element={
              showDocs ? (
                <DocsPage showDevSections={showDevDocs} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/releases" element={<ReleasesPage />} />
          <Route
            path="/users"
            element={showUsers ? <UsersPage /> : <Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

/** Full icon browser (not used inside the Figma plugin panel). */
export function App() {
  return (
    <Routes>
      <Route path="/invite" element={<InvitePage />} />
      <Route
        path="/*"
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      />
    </Routes>
  )
}
