import { useEffect } from 'react'
import { useTheme } from './theme'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { ConceptsPage, ConceptDetailPage } from './Concepts'
import { StudyPage } from './Study'
import { StatsPage } from './Stats'
import { SettingsPage } from './Settings'
import { Icon } from './components'
function ScrollReset() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return null
}
export function App() {
  const { theme, setTheme } = useTheme()
  return (
    <HashRouter>
      <ScrollReset />
      <div className="app-shell">
        <aside className="sidebar">
          <NavLink className="brand" to="/concepts">
            <span className="brand-mark">
              <Icon name="spark" />
            </span>
            <div>
              Dynamic<span>FLASHCARDS</span>
            </div>
          </NavLink>
          <div className="sidebar-caption">APRENDE LA IDEA.</div>
          <nav aria-label="Navegación principal">
            <NavLink to="/concepts">
              <Icon name="cards" />
              Conceptos
            </NavLink>
            <NavLink to="/study">
              <Icon name="study" />
              Estudiar
            </NavLink>
            <NavLink to="/stats">
              <Icon name="stats" />
              Estadísticas
            </NavLink>
            <NavLink to="/settings">
              <Icon name="settings" />
              Ajustes
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <div className="local-badge">
              <i className="dot" /> Local y privado
            </div>
            <p>
              La pregunta cambia.
              <br />
              El conocimiento se queda.
            </p>
            <span className="version">v0.1 · Frontend</span>
          </div>
        </aside>
        <div className="main-shell">
          <div className="topbar">
            <span>Tu espacio de aprendizaje</span>
            <div className="topbar-actions">
              <span className="status-chip">
                <i className="dot" />
                Demo de interfaz
              </span>
              <button
                className="theme-toggle"
                aria-label={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                <Icon name={theme === 'light' ? 'moon' : 'sun'} />
                <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
              </button>
            </div>
          </div>
          <main>
            <Routes>
              <Route path="/concepts" element={<ConceptsPage />} />
              <Route path="/concepts/:id" element={<ConceptDetailPage />} />
              <Route path="/study" element={<StudyPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/concepts" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
