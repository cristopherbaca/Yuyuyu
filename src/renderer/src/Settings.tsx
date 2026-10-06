import { useState, type FormEvent } from 'react'
import type { PublicSettings } from '../../shared/ipc'
import { unwrap, message } from './api'
import { ErrorBox, Icon, Notice, PageHeader, useResource } from './components'
export function SettingsPage() {
  const resource = useResource(() => unwrap(window.api.settings.get()))
  const [draft, setDraft] = useState<PublicSettings | null>(null)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const settings = draft ?? resource.data
  function change<K extends keyof PublicSettings>(field: K, value: PublicSettings[K]) {
    if (settings) setDraft({ ...settings, [field]: value })
  }
  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      setInfo(await action())
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    await run(async () => {
      const { apiKeySet: _keySet, secretWarning: _warning, ...values } = settings
      const saved = await unwrap(window.api.settings.set(values))
      setDraft(saved)
      return 'Preferencias guardadas.'
    })
  }
  return (
    <>
      <PageHeader
        eyebrow="A TU MANERA"
        title="Ajustes"
        description="Tu práctica, tus modelos y tus datos. Siempre bajo tu control."
      />
      <ErrorBox error={error || resource.error} />
      {info && <Notice>{info}</Notice>}
      {settings ? (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>Conexión con OpenAI</h2>
              <span className={`badge ${settings.apiKeySet ? 'positive' : ''}`}>
                {settings.apiKeySet ? 'Clave guardada' : 'Sin clave'}
              </span>
            </div>
            <p className="muted">
              La clave permanece en este dispositivo y nunca se devuelve a esta pantalla.
            </p>
            {settings.secretWarning && <Notice>{settings.secretWarning}</Notice>}
            <form
              className="key-form"
              onSubmit={(e) => {
                e.preventDefault()
                void run(async () => {
                  const saved = await unwrap(window.api.settings.setApiKey(key))
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          apiKeySet: saved.apiKeySet,
                          secretWarning: saved.secretWarning,
                        }
                      : saved,
                  )
                  setKey('')
                  return 'Clave guardada.'
                })
              }}
            >
              <label>
                Nueva clave API
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Pega tu clave aquí"
                />
              </label>
              <button disabled={busy || !key}>Guardar clave</button>
              {settings.apiKeySet && (
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const saved = await unwrap(window.api.settings.setApiKey(''))
                      setDraft((current) =>
                        current ? { ...current, apiKeySet: saved.apiKeySet } : saved,
                      )
                      return 'Clave eliminada.'
                    })
                  }
                >
                  Eliminar clave
                </button>
              )}
            </form>
          </section>
          <form onSubmit={(e) => void save(e)}>
            <section className="panel">
              <h2>Modelos y generación</h2>
              <p className="muted">
                Introduce modelos con Structured Outputs a los que tenga acceso tu cuenta. Usa un
                modelo económico para generar y diagnosticar; uno más potente para verificar y
                evaluar.
              </p>
              <div className="split">
                <label>
                  Modelo de generación
                  <input
                    value={settings.modelGenerate}
                    onChange={(e) => change('modelGenerate', e.target.value)}
                    placeholder="Modelo económico disponible en tu cuenta"
                  />
                </label>
                <label>
                  Modelo de verificación
                  <input
                    value={settings.modelVerify}
                    onChange={(e) => change('modelVerify', e.target.value)}
                    placeholder="Modelo potente disponible en tu cuenta"
                  />
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.fakeLlm}
                  onChange={(e) => change('fakeLlm', e.target.checked)}
                />
                <span>
                  <strong>Modo de simulación (FAKE_LLM)</strong>
                  <small>
                    Generación y evaluación deterministas, sin conexión ni coste. Para probar el
                    flujo; no sustituye una evaluación real.
                  </small>
                </span>
              </label>
            </section>
            <section className="panel">
              <h2>Ritmo de aprendizaje</h2>
              <div className="settings-grid">
                <label>
                  Variantes listas por concepto
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.targetPoolSize}
                    onChange={(e) => change('targetPoolSize', Number(e.target.value))}
                  />
                </label>
                <label>
                  Conceptos nuevos por día
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.newConceptsPerDay}
                    onChange={(e) => change('newConceptsPerDay', Number(e.target.value))}
                  />
                </label>
                <label>
                  Retención deseada
                  <input
                    type="number"
                    min={0.7}
                    max={0.99}
                    step={0.01}
                    value={settings.desiredRetention}
                    onChange={(e) => change('desiredRetention', Number(e.target.value))}
                  />
                  <small>
                    0,90 equivale al 90%. FSRS usa este objetivo para programar los próximos
                    repasos.
                  </small>
                </label>
              </div>
              <button className="primary" disabled={busy}>
                Guardar preferencias
              </button>
            </section>
          </form>
          <section className="panel">
            <h2>Banco y datos locales</h2>
            <p className="muted">
              El banco se rellena al iniciar y cada 30 minutos mientras la app está abierta.
            </p>
            <div className="button-row">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await unwrap(window.api.jobs.refillNow())
                    return 'Relleno en segundo plano solicitado.'
                  })
                }
              >
                <Icon name="spark" /> Rellenar banco ahora
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await unwrap(window.api.data.export())
                    return result.canceled ? 'Exportación cancelada.' : 'Datos exportados.'
                  })
                }
              >
                Exportar datos
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await unwrap(window.api.data.seed())
                    return `${result.created} conceptos de ejemplo añadidos.`
                  })
                }
              >
                Cargar datos de ejemplo
              </button>
            </div>
          </section>
        </>
      ) : (
        <Notice>Cargando ajustes…</Notice>
      )}
    </>
  )
}
