import { getClient, useCards } from '../../app/client'
import { deckCounts } from '../../src/demo'
import { Chip, PageHeader } from '../../design-system/primitives'
export function StatsPage() {
  const data = useCards(),
    client = getClient(),
    today = new Date().toDateString(),
    reviews = data.reviews.filter((r) => new Date(r.reviewedAt).toDateString() === today),
    counts = deckCounts(data)
  const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - 6 + i)
      return {
        label: date.toLocaleDateString('es', { weekday: 'short' }),
        count: data.reviews.filter(
          (r) => new Date(r.reviewedAt).toDateString() === date.toDateString(),
        ).length,
      }
    }),
    max = Math.max(1, ...days.map((d) => d.count))
  const errors = data.reviews
    .filter((r) => r.errorSummary)
    .slice(-5)
    .reverse()
  return (
    <>
      <PageHeader
        title="Estadísticas"
        description="Un vistazo a tu práctica, sin ruido."
        action={<Chip>Últimos 7 días</Chip>}
      />
      <div className="stat-tiles">
        <div>
          <span>Por repasar hoy</span>
          <strong>{counts.due + counts.learning}</strong>
          <small>{counts.new} tarjetas nuevas</small>
        </div>
        <div>
          <span>Repasadas hoy</span>
          <strong>{reviews.length}</strong>
          <small>Tarjetas completadas</small>
        </div>
        <div>
          <span>Valoraciones positivas</span>
          <strong>
            {reviews.length
              ? Math.round((reviews.filter((r) => r.rating >= 3).length / reviews.length) * 100)
              : 0}
            <small>%</small>
          </strong>
          <small>Bien y Fácil · autoevaluación</small>
        </div>
        <div>
          <span>Tiempo de estudio</span>
          <strong>
            {Math.round(reviews.reduce((sum, r) => sum + r.seconds, 0) / 60)}
            <small> min</small>
          </strong>
          <small>Práctica de hoy</small>
        </div>
      </div>
      <section className="stats-section">
        <div className="section-heading">
          <h2>Tu práctica esta semana</h2>
          <span className="muted">Tarjetas repasadas</span>
        </div>
        <div
          className="activity-chart"
          role="img"
          aria-label={days.map((d) => `${d.label}: ${d.count} tarjetas`).join(', ')}
        >
          <div className="chart-bars">
            {days.map((day, i) => (
              <div className="chart-column" key={i}>
                <span className="chart-value">{day.count || ''}</span>
                <div className="bar-track">
                  <div
                    className={`bar ${day.count === 0 ? 'bar-empty' : ''}`}
                    style={{ height: `${(day.count / max) * 100}%` }}
                  />
                </div>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="stats-section">
        <h2>Tarjetas a reforzar</h2>
        {errors.length ? (
          errors.map((r) => (
            <div className="error-row" key={r.id}>
              <strong>{data.concepts.find((c) => c.id === r.conceptId)?.title}</strong>
              <span>{r.errorSummary}</span>
            </div>
          ))
        ) : (
          <p className="muted">Las tarjetas que te cuesten más aparecerán aquí.</p>
        )}
      </section>
      <section className="stats-section">
        <h2>Uso de IA</h2>
        <table className="usage-table">
          <thead>
            <tr>
              <th>Propósito</th>
              <th>Llamadas</th>
              <th>Coste estimado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Generación y evaluación</td>
              <td>0</td>
              <td>$0.00</td>
            </tr>
          </tbody>
        </table>
        <p className="helper-text">
          {client.mode === 'local'
            ? 'Sin servicio conectado. No se realizan llamadas ni se cobran costes.'
            : 'Datos de demostración. No se realizan llamadas reales.'}
        </p>
      </section>
    </>
  )
}
