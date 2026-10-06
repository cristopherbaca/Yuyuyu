import { useDemo } from './store'
import { date } from './api'
import { Notice, PageHeader } from './components'
export function StatsPage() {
  const { concepts, reviews } = useDemo()
  const today = new Date().toDateString()
  const practiced = new Set(reviews.map((r) => r.conceptId)).size
  return (
    <>
      <PageHeader
        eyebrow="EL HÁBITO EN NÚMEROS"
        title="Tu progreso"
        description="Cada momento de práctica deja una huella."
      />
      <div className="stats-cards">
        <div className="panel">
          <span>Conceptos</span>
          <strong>{concepts.length}</strong>
          <p>Ideas en tu biblioteca</p>
        </div>
        <div className="panel">
          <span>Prácticas de hoy</span>
          <strong>
            {reviews.filter((r) => new Date(r.reviewedAt).toDateString() === today).length}
          </strong>
          <p>Un momento de atención</p>
        </div>
        <div className="panel">
          <span>Conceptos practicados</span>
          <strong>{practiced}</strong>
          <p>Con al menos una autoevaluación</p>
        </div>
        <div className="panel">
          <span>Prácticas totales</span>
          <strong>{reviews.length}</strong>
          <p>Guardadas en este dispositivo</p>
        </div>
      </div>
      <section className="panel">
        <h2>Actividad reciente</h2>
        {reviews.length ? (
          reviews
            .slice(-10)
            .reverse()
            .map((r) => (
              <div className="review-history" key={r.id}>
                <span
                  className={`verdict ${r.rating === 1 ? 'fail' : r.rating === 2 ? 'partial' : 'pass'}`}
                >
                  {['Otra vez', 'Difícil', 'Bien', 'Fácil'][r.rating - 1]}
                </span>
                <div>
                  <strong>{concepts.find((c) => c.id === r.conceptId)?.title ?? 'Concepto'}</strong>
                  <p>{date(r.reviewedAt)}</p>
                </div>
              </div>
            ))
        ) : (
          <p className="muted">Tus prácticas aparecerán aquí cuando completes tu primera sesión.</p>
        )}
      </section>
      <Notice>
        Estas cifras reflejan tu actividad en la demo. Las estadísticas de aprendizaje se añadirán
        con el backend.
      </Notice>
    </>
  )
}
