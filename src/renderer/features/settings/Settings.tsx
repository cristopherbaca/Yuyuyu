import { useState } from 'react'
import { APP_NAME } from '../../../shared/app'
import { getClient } from '../../app/client'
import { useUI } from '../../app/ui'
import { useTheme } from '../../src/theme'
import { message, unwrap } from '../../src/api'
import {
  Button,
  Chip,
  Notice,
  PageHeader,
  PropertyRow,
  SegmentedControl,
} from '../../design-system/primitives'
export function SettingsPage() {
  const { preference, setPreference } = useTheme(),
    client = getClient(),
    ui = useUI(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function exportData() {
    setBusy(true)
    setError('')
    try {
      const json = client.export()
      if (window.desktop) {
        const result = await unwrap(window.desktop.exportJson(json))
        if (!result.canceled) ui.toast('Tarjetas exportadas')
      } else {
        const blob = new Blob([json], { type: 'application/json' }),
          url = URL.createObjectURL(blob),
          link = document.createElement('a')
        link.href = url
        link.download = `${APP_NAME.toLowerCase()}-tarjetas.json`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        ui.toast('Tarjetas exportadas')
      }
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader title="Ajustes" description="Tu práctica y tu espacio, a tu manera." />
      {error && <Notice error>{error}</Notice>}
      <section className="settings-section">
        <h2>Apariencia</h2>
        <PropertyRow label="Tema">
          <SegmentedControl
            label="Tema de la aplicación"
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
              { value: 'system', label: 'Sistema' },
            ]}
          />
        </PropertyRow>
        <p className="helper-text">
          Sistema sigue la apariencia de tu dispositivo. Tu elección se guarda automáticamente.
        </p>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <h2>Conexión con OpenAI</h2>
          <Chip>Sin servicio conectado</Chip>
        </div>
        <p className="muted">
          La conexión y el almacenamiento seguro de la clave estarán disponibles al añadir el
          backend.
        </p>
        <PropertyRow label="Clave API">
          <input
            type="password"
            aria-label="Clave API"
            placeholder="Disponible al conectar el servicio"
            autoComplete="off"
            disabled
          />
        </PropertyRow>
        <PropertyRow label="Modelo de generación">
          <input
            aria-label="Modelo de generación"
            placeholder="Modelo económico de tu cuenta"
            disabled
          />
        </PropertyRow>
        <PropertyRow label="Modelo de verificación">
          <input
            aria-label="Modelo de verificación"
            placeholder="Modelo con Structured Outputs"
            disabled
          />
        </PropertyRow>
        <p className="helper-text">
          Usa modelos a los que tenga acceso tu cuenta. Esta interfaz no guarda claves.
        </p>
      </section>
      <section className="settings-section">
        <h2>Estudio</h2>
        <PropertyRow label="Versiones por tarjeta">
          <span className="muted">5 · al conectar el servicio</span>
        </PropertyRow>
        <PropertyRow label="Tarjetas nuevas por día">
          <span className="muted">10 · al conectar la programación</span>
        </PropertyRow>
        <PropertyRow label="Retención deseada">
          <span className="muted">90% · al conectar FSRS</span>
        </PropertyRow>
      </section>
      <section className="settings-section">
        <h2>Datos</h2>
        <PropertyRow label="Tarjetas y repasos">
          <Button onClick={() => void exportData()} loading={busy}>
            Exportar datos
          </Button>
        </PropertyRow>
        <PropertyRow label="Explorar la aplicación">
          <Button
            onClick={() => {
              const count = client.seed()
              ui.toast(
                count
                  ? `${count} tarjetas de ejemplo añadidas`
                  : 'Los ejemplos ya están en tu biblioteca',
              )
            }}
          >
            Cargar datos de ejemplo
          </Button>
        </PropertyRow>
      </section>
      <section className="settings-section">
        <h2>Avanzado</h2>
        <PropertyRow label="Simulación de respuestas">
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Modo de simulación"
              checked={client.mode === 'mock'}
              disabled
            />
            <span />
          </label>
        </PropertyRow>
        <p className="helper-text">
          Disponible solo en desarrollo con ?mock=1. Las respuestas de demostración no se incluyen
          en la aplicación publicada.
        </p>
      </section>
    </>
  )
}
