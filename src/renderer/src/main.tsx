import React, { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'
import 'katex/dist/katex.min.css'
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="empty panel">
        <h1>No se pudo abrir esta pantalla.</h1>
        <p>Tus datos locales están guardados.</p>
        <button onClick={() => location.reload()}>Volver a intentar</button>
      </div>
    ) : (
      this.props.children
    )
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
)
