import { unwrap } from './api'
import { ErrorBox, Notice, PageHeader, useResource } from './components'
const purposeLabels: Record<string, string> = {
  generate: 'Generación',
  'blind-solve': 'Solución independiente',
  judge: 'Verificación',
  grade: 'Evaluación',
  diagnose: 'Diagnóstico',
  'suggest-edges': 'Conexiones',
}
export function StatsPage() {
  const resource = useResource(() => unwrap(window.api.stats.get()))
  const s = resource.data
  return (
    <>
      <PageHeader
        eyebrow="EL HÁBITO EN NÚMEROS"
        title="Tu progreso"
        description="Comprender lleva tiempo. Cada repaso deja una huella."
      />
      <ErrorBox error={resource.error} />
      {s ? (
        <>
          <div className="stats-cards">
            <div className="panel">
              <span>Conceptos pendientes</span>
              <strong>{s.dueCount}</strong>
              <p>Listos para tu próximo repaso</p>
            </div>
            <div className="panel">
              <span>Repasos de hoy</span>
              <strong>{s.reviewsToday}</strong>
              <p>Una perspectiva cada vez</p>
            </div>
            <div className="panel">
              <span>Recuerdo estimado</span>
              <strong>
                {Math.round(s.retentionEstimate * 100)}
                <small>%</small>
              </strong>
              <p>Predicción de FSRS, conceptos repasados</p>
            </div>
            <div className="panel">
              <span>Coste LLM estimado</span>
              <strong>
                ${s.llmCosts.reduce((n, cost) => n + cost.estimatedUsd, 0).toFixed(4)}
              </strong>
              <p>Estimación orientativa en USD</p>
            </div>
          </div>
          <div className="detail-columns">
            <section className="panel">
              <h2>Lo que estamos reforzando</h2>
              {s.errors.length ? (
                <ul className="error-list">
                  {s.errors.map((error, i) => (
                    <li key={i}>
                      <span>↻</span>
                      {error}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  Tus errores recientes aparecerán aquí para ayudarte a descubrir qué conviene
                  reforzar.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Uso de modelos</h2>
              {s.llmCosts.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Propósito</th>
                        <th>Llamadas</th>
                        <th>Tokens E/S</th>
                        <th>USD aprox.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.llmCosts.map((cost) => (
                        <tr key={cost.purpose}>
                          <td>{purposeLabels[cost.purpose] ?? cost.purpose}</td>
                          <td>{cost.calls}</td>
                          <td>
                            {cost.inputTokens.toLocaleString()} /{' '}
                            {cost.outputTokens.toLocaleString()}
                          </td>
                          <td>${cost.estimatedUsd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Todavía no hay llamadas registradas.</p>
              )}
              <p className="tiny muted">
                Tarifas ilustrativas por millón de tokens: generación $0,50 / $2; verificación $5 /
                $15. No es una factura. Las llamadas de simulación cuestan $0.
              </p>
            </section>
          </div>
        </>
      ) : (
        <Notice>Cargando estadísticas…</Notice>
      )}
    </>
  )
}
