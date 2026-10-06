import { useState } from 'react'
import { demo, useDemo } from './store'
import { useTheme } from './theme'
import { message, unwrap } from './api'
import { ErrorBox, Notice, PageHeader } from './components'
export function SettingsPage() {
  useDemo()
  const { theme, setTheme } = useTheme()
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  async function exportData() {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (!window.desktop)
        throw new Error('La exportación está disponible en la aplicación de escritorio.')
      const result = await unwrap(window.desktop.exportJson(demo.export()))
      setInfo(result.canceled ? 'Exportación cancelada.' : 'Datos exportados.')
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A TU MANERA"
        title="Ajustes"
        description="Un espacio que se adapta a ti."
      />
      <ErrorBox error={error} />
      {info && <Notice>{info}</Notice>}
      <section className="panel">
        <div className="section-title">
          <h2>Apariencia</h2>
          <span className="badge">{theme === 'light' ? 'Tema claro' : 'Tema oscuro'}</span>
        </div>
        <p className="muted">
          Elige el ambiente que te ayuda a concentrarte. Tu elección se guarda en este dispositivo.
        </p>
        <div className="theme-options">
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              className={`theme-option ${theme === value ? 'selected' : ''}`}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              <div className={`theme-preview theme-preview-${value}`} aria-hidden="true">
                <span className="mini-sidebar" />
                <span className="mini-content">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <span>{value === 'light' ? 'Claro' : 'Oscuro'}</span>
              <small>{value === 'light' ? 'Suave y luminoso' : 'Tranquilo y cómodo'}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Datos de demostración</h2>
        <p className="muted">
          Tus conceptos y autoevaluaciones se guardan localmente. Puedes exportarlos como JSON.
        </p>
        {demo.getWarning() && <Notice>{demo.getWarning()}</Notice>}
        <div className="button-row">
          <button onClick={() => setInfo(`${demo.seed()} conceptos de ejemplo añadidos.`)}>
            Cargar datos de ejemplo
          </button>
          <button disabled={busy} onClick={() => void exportData()}>
            {busy ? 'Exportando…' : 'Exportar datos'}
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Tu espacio, en construcción.</h2>
        <p className="muted">
          Esta versión permite explorar la interfaz, escribir notas y practicar con autoevaluación.
          La generación de variantes y la programación de repasos se añadirán al conectar el
          backend.
        </p>
        <span className="badge">Frontend · v0.1</span>
      </section>
    </>
  )
}
