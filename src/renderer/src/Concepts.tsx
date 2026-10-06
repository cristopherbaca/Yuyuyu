import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Mode } from './demo'
import { demo, useDemo } from './store'
import { date, message } from './api'
import { ErrorBox, Icon, Markdown, Notice, PageHeader } from './components'
const labels = { simple: 'Simple', problem: 'Problemas', both: 'Ambas' }
export function ConceptsPage() {
  const { concepts } = useDemo()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<Mode>('both')
  const navigate = useNavigate()
  function create(event: FormEvent) {
    event.preventDefault()
    try {
      const concept = demo.create({ title, noteText: note, modePref: mode })
      navigate(`/concepts/${concept.id}`)
    } catch (error) {
      setError(message(error))
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="TU BIBLIOTECA"
        title="Ideas que se quedan."
        description="Organiza tus notas y prueba tu espacio de aprendizaje."
        action={
          <button className="primary" onClick={() => setCreating(!creating)}>
            <Icon name="plus" />
            {creating ? 'Cerrar formulario' : 'Nuevo concepto'}
          </button>
        }
      />
      <ErrorBox error={error} />
      {demo.getWarning() && <Notice>{demo.getWarning()}</Notice>}
      {creating && (
        <form className="panel concept-form" onSubmit={create}>
          <div className="section-title">
            <h2>Todo empieza con una idea.</h2>
            <span className="badge">Markdown + LaTeX</span>
          </div>
          <label>
            Título
            <input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Por ejemplo: Teorema de Pitágoras"
              required
            />
          </label>
          <div className="split">
            <label>
              Tu nota
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={8}
                maxLength={40000}
                placeholder="Escribe los hechos, las fórmulas y los ejemplos que quieres aprender."
                required
              />
            </label>
            <div>
              <span className="field-label">Vista previa</span>
              <div className="preview">
                <Markdown text={note || '*Tu nota aparecerá aquí.*'} />
              </div>
            </div>
          </div>
          <label>
            Tipo de práctica
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="simple">Simple</option>
              <option value="problem">Problemas</option>
              <option value="both">Ambas</option>
            </select>
            <small>Preferencia para la futura generación de variantes.</small>
          </label>
          <button className="primary">Guardar concepto</button>
        </form>
      )}
      <div className="summary-strip">
        <span>
          <strong>{concepts.length}</strong> conceptos
        </span>
        <span>
          <i className="dot" /> Guardados en este dispositivo
        </span>
        <span className="muted">Vista de demostración</span>
      </div>
      {!concepts.length ? (
        <div className="empty panel">
          <div className="empty-icon">
            <Icon name="cards" />
          </div>
          <h2>Tu próxima idea vive aquí.</h2>
          <p>Añade tu primera nota o explora tres conceptos de ejemplo.</p>
          <button className="primary" onClick={() => setCreating(true)}>
            Crear mi primer concepto
          </button>
          <button className="text-button" onClick={() => demo.seed()}>
            Cargar datos de ejemplo <span>↗</span>
          </button>
        </div>
      ) : (
        <div className="concept-grid">
          {concepts.map((c) => (
            <Link className="concept-card" to={`/concepts/${c.id}`} key={c.id}>
              <div className="card-top">
                <span className="badge">{labels[c.modePref]}</span>
                <span className="due-badge">Nota local</span>
              </div>
              <h2>{c.title}</h2>
              <p className="note-excerpt">{c.noteText.replace(/[#*$]/g, '').slice(0, 150)}</p>
              <div className="card-footer">
                <span>Explorar concepto</span>
                <Icon name="arrow" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
export function ConceptDetailPage() {
  const { id = '' } = useParams()
  const { concepts, reviews } = useDemo()
  const concept = concepts.find((c) => c.id === id)
  const history = reviews
    .filter((r) => r.conceptId === id)
    .slice()
    .reverse()
    .slice(0, 10)
  const navigate = useNavigate()
  const [edit, setEdit] = useState(false)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<Mode>('both')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!concept)
    return (
      <>
        <Notice>No se encontró el concepto.</Notice>
        <Link to="/concepts">Volver a conceptos</Link>
      </>
    )
  return (
    <>
      <Link className="back-link" to="/concepts">
        ← Todos los conceptos
      </Link>
      <PageHeader
        eyebrow={labels[concept.modePref].toUpperCase()}
        title={concept.title}
        action={
          <button
            onClick={() => {
              setEdit(!edit)
              setNote(concept.noteText)
              setMode(concept.modePref)
            }}
          >
            {edit ? 'Cancelar' : 'Editar nota'}
          </button>
        }
      />
      <ErrorBox error={error} />
      {demo.getWarning() && <Notice>{demo.getWarning()}</Notice>}
      <div className="detail-columns">
        <section className="panel">
          <div className="section-title">
            <h2>La nota original</h2>
            <span className="badge">Tu conocimiento</span>
          </div>
          {edit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                try {
                  demo.update(id, { title: concept.title, noteText: note, modePref: mode })
                  setEdit(false)
                } catch (error) {
                  setError(message(error))
                }
              }}
            >
              <label>
                Nota Markdown
                <textarea
                  rows={14}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={40000}
                  required
                />
              </label>
              <label>
                Práctica
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary">Guardar cambios</button>
            </form>
          ) : (
            <Markdown text={concept.noteText} />
          )}
        </section>
        <aside>
          <section className="panel">
            <h2>Practica esta idea</h2>
            <p className="muted">Recuerda el concepto y contrasta tu respuesta con tu nota.</p>
            <Link className="button-link primary" to={`/study?concept=${id}`}>
              Repasar concepto <Icon name="arrow" />
            </Link>
          </section>
          <section className="panel">
            <h2>Más perspectivas, pronto.</h2>
            <p className="muted">
              La generación de variantes, las conexiones y la programación de repasos estarán
              disponibles cuando se conecte el backend.
            </p>
            <span className="badge">Demo de interfaz</span>
          </section>
        </aside>
      </div>
      <section className="panel">
        <h2>Prácticas recientes</h2>
        {history.length ? (
          history.map((r) => (
            <div className="review-history" key={r.id}>
              <span
                className={`verdict ${r.rating === 1 ? 'fail' : r.rating === 2 ? 'partial' : 'pass'}`}
              >
                {['Otra vez', 'Difícil', 'Bien', 'Fácil'][r.rating - 1]}
              </span>
              <div>
                <strong>{date(r.reviewedAt)}</strong>
                <p>Autoevaluación de demostración</p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Todavía no has practicado este concepto.</p>
        )}
      </section>
      <div className="delete-row">
        {confirmDelete ? (
          <>
            <span>¿Eliminar este concepto y su historial de demo?</span>
            <button
              className="danger"
              onClick={() => {
                demo.delete(id)
                navigate('/concepts')
              }}
            >
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </>
        ) : (
          <button className="text-button danger-text" onClick={() => setConfirmDelete(true)}>
            Eliminar concepto
          </button>
        )}
      </div>
    </>
  )
}
