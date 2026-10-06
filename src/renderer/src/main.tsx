import React, { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../app/App'
import { setClient } from '../app/client'
import { ThemeProvider } from './theme'
import { APP_NAME } from '../../shared/app'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '../design-system/tokens.css'
import '../design-system/styles.css'
import 'katex/dist/katex.min.css'
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state">
        <h1>No se pudo abrir esta pantalla.</h1>
        <p>Tus tarjetas locales están guardadas.</p>
        <button onClick={() => location.reload()}>Volver a intentar</button>
      </div>
    ) : (
      this.props.children
    )
  }
}
async function start() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('mock') === '1') {
    const { installMock } = await import('../app/mock')
    setClient(installMock(new URLSearchParams(location.search)))
  }
  document.title = APP_NAME
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Boundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Boundary>
    </React.StrictMode>,
  )
}
void start()
