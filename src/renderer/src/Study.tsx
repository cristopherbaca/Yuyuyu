import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { demo, useDemo } from './store'
import type { Concept } from './demo'
import { ErrorBox, Icon, Markdown, Notice, PageHeader } from './components'
import { message } from './api'
const ratingLabels = ['Otra vez', 'Difícil', 'Bien', 'Fácil']
export function StudyPage() {
  const { concepts } = useDemo()
  const [params] = useSearchParams()
  const selected = params.get('concept')
  const [effort, setEffort] = useState('normal')
  const [minutes, setMinutes] = useState(10)
  const [items, setItems] = useState<Concept[] | null>(null)
  const [index, setIndex] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [error, setError] = useState('')
  const rated = useRef(false)
  const item = items?.[index]
  useEffect(() => {
    setReveal(false)
    setRating(null)
    setError('')
    rated.current = false
  }, [index, items])
  function rate(value: number) {
    if (!item || !reveal || rated.current) return
    try {
      demo.review(item.id, value)
      rated.current = true
      setRating(value)
    } catch (error) {
      setError(message(error))
    }
  }
  function next() {
    rated.current = false
    setIndex((i) => i + 1)
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!item || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setItems(null)
        setIndex(0)
        return
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return
      if (['1', '2', '3', '4'].includes(event.key) && reveal && rating === null) {
        event.preventDefault()
        rate(Number(event.key))
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (rating !== null) next()
        else if (!reveal) setReveal(true)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [item, reveal, rating])
  if (items === null)
    return (
      <>
        <PageHeader
          eyebrow="UN POCO, CADA DÍA"
          title="Haz espacio para aprender."
          description="Un momento de atención. Una idea que se queda."
        />
        <div className="study-intro">
          <section className="panel study-setup">
            <span className="eyebrow">TU SESIÓN</span>
            <h2>¿Cómo quieres practicar?</h2>
            <p className="muted">
              Esta demo usa tus notas para practicar el recuerdo y la autoevaluación.
            </p>
            <div className="effort-options">
              {[
                { value: 'quick', label: 'Rápido', desc: 'Un repaso breve' },
                { value: 'normal', label: 'Normal', desc: 'Tu ritmo diario' },
                { value: 'deep', label: 'Profundo', desc: 'Más tiempo para pensar' },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`effort-option ${effort === option.value ? 'selected' : ''}`}
                  aria-pressed={effort === option.value}
                  onClick={() => setEffort(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.desc}</small>
                </button>
              ))}
            </div>
            <label>
              Tengo {minutes} minutos
              <input
                type="range"
                min={1}
                max={30}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            {selected && <Notice>Practicarás el concepto seleccionado.</Notice>}
            <button
              className="primary"
              disabled={!concepts.length}
              onClick={() => {
                setIndex(0)
                setItems(
                  concepts
                    .filter((c) => !selected || c.id === selected)
                    .slice(
                      0,
                      Math.max(
                        1,
                        Math.floor(
                          (minutes * 60) / ({ quick: 20, normal: 40, deep: 90 }[effort] ?? 40),
                        ),
                      ),
                    ),
                )
              }}
            >
              Empezar a estudiar <Icon name="arrow" />
            </button>
            {!concepts.length && (
              <p className="muted">
                Añade un concepto o <Link to="/concepts">carga los ejemplos</Link> para comenzar.
              </p>
            )}
          </section>
          <div className="study-art" aria-hidden="true">
            <div className="floating-card card-back">
              <span>01 / RECUERDA</span>
              <p>Una idea.</p>
            </div>
            <div className="floating-card card-front">
              <Icon name="spark" />
              <h2>
                Muchas maneras
                <br />
                de entenderla.
              </h2>
              <span>APRENDE LA IDEA.</span>
            </div>
          </div>
        </div>
        <Notice>
          Demo de interfaz: la generación, la evaluación automática y la programación de repasos se
          conectarán más adelante.
        </Notice>
      </>
    )
  if (!item)
    return (
      <>
        <PageHeader eyebrow="UN PASO MÁS" title="Sesión completada." />
        <div className="empty panel">
          <div className="empty-icon">
            <Icon name="spark" />
          </div>
          <h2>Tu atención suma.</h2>
          <p>
            Has practicado {items.length} {items.length === 1 ? 'concepto' : 'conceptos'}.
          </p>
          <button
            className="primary"
            onClick={() => {
              setItems(null)
              setIndex(0)
            }}
          >
            Volver a estudiar
          </button>
        </div>
      </>
    )
  return (
    <>
      <div className="session-top">
        <span className="eyebrow">PRÁCTICA DE RECUERDO</span>
        <span>
          {index + 1} de {items.length}
        </span>
        <button
          className="text-button"
          onClick={() => {
            setItems(null)
            setIndex(0)
          }}
        >
          Salir <kbd>Esc</kbd>
        </button>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Progreso de la sesión"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={index}
      >
        <div style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <ErrorBox error={error} />
      {demo.getWarning() && <Notice>{demo.getWarning()}</Notice>}
      <section className="review-card panel">
        <div className="section-title">
          <span className="badge">Recuerdo · demo</span>
          <span className="muted">{item.title}</span>
        </div>
        <div className="review-question">
          <h2>¿Qué recuerdas sobre {item.title}?</h2>
        </div>
        <p className="muted">Piensa en la idea principal y explícalo con tus propias palabras.</p>
        {!reveal && (
          <div className="review-actions">
            <div className="grow" />
            <button className="primary" onClick={() => setReveal(true)}>
              Mostrar respuesta <kbd>Espacio</kbd>
            </button>
          </div>
        )}
        <details className="why">
          <summary>¿Por qué me salió esto?</summary>
          <p>Has elegido practicar tus notas. Esta demo sigue el orden de tu biblioteca.</p>
        </details>
      </section>
      {reveal && (
        <>
          <section className="panel answer-panel">
            <span className="eyebrow">CONTRASTA CON TU NOTA</span>
            <Markdown text={item.noteText} />
          </section>
          {rating === null ? (
            <div className="rating-panel">
              <p>¿Cuánto te costó recordarlo?</p>
              <div className="rating-buttons">
                {ratingLabels.map((label, i) => (
                  <button
                    key={label}
                    className={`rating rating-${i + 1}`}
                    onClick={() => rate(i + 1)}
                  >
                    <span>{label}</span>
                    <kbd>{i + 1}</kbd>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="result-actions panel">
              <div>
                <span className="muted">Práctica registrada</span>
                <strong>{ratingLabels[rating - 1]}</strong>
                <small>Autoevaluación · demo</small>
              </div>
              <button className="primary" onClick={next}>
                {index + 1 === items.length ? 'Terminar sesión' : 'Siguiente'}
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
