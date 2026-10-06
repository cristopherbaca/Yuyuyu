import { useEffect, useRef, useState } from 'react'
import {
  HashRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { APP_NAME } from '../../shared/app'
import { getClient } from './client'
import { isEditable, UIProvider, type EditorRequest } from './ui'
import { Button, Chip, Icon, IconButton, Keycap } from '../design-system/primitives'
import { useTheme } from '../src/theme'
import { DecksPage } from '../features/decks/Decks'
import { OverviewPage } from '../features/decks/Overview'
import { Reviewer, StudyEntry } from '../features/study/Reviewer'
import { CardEditor } from '../features/add/CardEditor'
import { BrowsePage } from '../features/browse/Browse'
import { StatsPage } from '../features/stats/Stats'
import { SettingsPage } from '../features/settings/Settings'
function Shell() {
  const [editor, setEditor] = useState<EditorRequest | null>(null),
    [toast, setToast] = useState(''),
    [online, setOnline] = useState(navigator.onLine),
    location = useLocation(),
    navigate = useNavigate(),
    { theme, setPreference } = useTheme(),
    client = getClient(),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const studying = location.pathname.startsWith('/study/')
  function showToast(message: string) {
    setToast(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 3500)
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.repeat || document.querySelector('dialog[open]')) return
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'f' &&
        !location.pathname.startsWith('/browse')
      ) {
        event.preventDefault()
        navigate('/browse')
        setTimeout(
          () => document.querySelector<HTMLInputElement>('[aria-label="Buscar tarjetas"]')?.focus(),
          100,
        )
        return
      }
      if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setEditor({})
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [location.pathname])
  const nav = [
    { path: '/decks', label: 'Mazos', icon: 'folder' },
    { path: '/study', label: 'Estudiar', icon: 'book' },
    { path: '/browse', label: 'Explorar', icon: 'list' },
    { path: '/stats', label: 'Estadísticas', icon: 'stats' },
    { path: '/settings', label: 'Ajustes', icon: 'settings' },
  ] as const
  const status =
    client.status === 'generating'
      ? 'Generando…'
      : client.status === 'no-key'
        ? 'Falta la API key'
        : client.status === 'offline' || !online
          ? 'Sin conexión'
          : client.mode === 'mock'
            ? 'Vista de diseño'
            : 'Modo local'
  const platform = window.desktop?.platform ?? 'browser'
  return (
    <UIProvider value={{ openEditor: (request) => setEditor(request ?? {}), toast: showToast }}>
      <div className={`app-shell ${studying ? 'app-reviewing' : ''} platform-${platform}`}>
        <header className="titlebar">
          <span>{APP_NAME}</span>
          {platform !== 'darwin' && platform !== 'browser' && (
            <div className="window-controls">
              <IconButton
                name="minimize"
                label="Minimizar"
                onClick={() => void window.desktop?.minimize()}
              />
              <IconButton
                name="maximize"
                label="Maximizar"
                onClick={() => void window.desktop?.toggleMaximize()}
              />
              <IconButton
                name="close"
                label="Cerrar aplicación"
                onClick={() => void window.desktop?.close()}
              />
            </div>
          )}
        </header>
        {!studying && (
          <aside className="sidebar">
            <NavLink className="brand" to="/decks">
              <span className="brand-glyph">
                <Icon name="copy" />
              </span>
              {APP_NAME}
            </NavLink>
            <Button variant="primary" className="sidebar-add" onClick={() => setEditor({})}>
              <Icon name="plus" />
              Añadir tarjeta<Keycap>A</Keycap>
            </Button>
            <nav aria-label="Navegación principal">
              {nav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <footer className="sidebar-footer">
              <Chip>
                <i className={`status-dot ${client.status === 'generating' ? 'busy' : ''}`} />
                {status}
              </Chip>
              <div>
                <span>Tu conocimiento, contigo.</span>
                <IconButton
                  name={theme === 'dark' ? 'sun' : 'moon'}
                  label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
                  onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
                />
              </div>
            </footer>
          </aside>
        )}
        <main className={studying ? 'main-reviewer' : 'main-content'}>
          <Routes>
            <Route path="/decks" element={<DecksPage />} />
            <Route path="/decks/:deckId" element={<OverviewPage />} />
            <Route path="/study" element={<StudyEntry />} />
            <Route path="/study/:deckId" element={<Reviewer key={location.pathname} />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/decks" replace />} />
          </Routes>
        </main>
        {editor && <CardEditor request={editor} onClose={() => setEditor(null)} />}
        <div className={`toast ${toast ? 'toast-visible' : ''}`} role="status" aria-live="polite">
          {toast && (
            <>
              <Icon name="check" />
              {toast}
            </>
          )}
        </div>
      </div>
    </UIProvider>
  )
}
export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
