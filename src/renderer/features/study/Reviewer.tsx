import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { getClient, useCards } from '../../app/client'
import { isEditable, useUI } from '../../app/ui'
import { ratingLabels, typeLabels, type Feedback, type Verdict, type Effort } from '../../app/types'
import {
  Button,
  Chip,
  Counts,
  DifficultyDots,
  EmptyState,
  Icon,
  IconButton,
  Keycap,
  Modal,
  Notice,
  ProgressLine,
  RatingGroup,
  Skeleton,
  VerdictLine,
} from '../../design-system/primitives'
import { Markdown } from '../../design-system/Markdown'
export function StudyEntry() {
  const data = useCards()
  let last: string | null = null
  try {
    last = localStorage.getItem('mnemo.last-deck')
  } catch {
    /*Use first deck*/
  }
  const deck = data.decks.find((d) => d.id === last) ?? data.decks[0]
  return deck ? (
    <Navigate to={`/study/${deck.id}`} replace />
  ) : (
    <EmptyState
      title="Elige tu primer mazo"
      description="Añade tarjetas a un mazo para empezar a estudiar."
      action={<Link to="/decks">Ir a Mazos</Link>}
    />
  )
}
export function Reviewer() {
  const { deckId = '' } = useParams(),
    [params] = useSearchParams(),
    data = useCards(),
    client = getClient(),
    ui = useUI(),
    navigate = useNavigate()
  const effort = (
    ['quick', 'normal', 'deep'].includes(params.get('effort') ?? '')
      ? params.get('effort')
      : 'normal'
  ) as Effort
  const minuteValue = params.get('minutes'),
    minutes = minuteValue === 'all' ? null : Math.max(1, Math.min(120, Number(minuteValue) || 10))
  const [items, setItems] = useState(() => client.buildSession(deckId, effort, minutes)),
    [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [rating, setRating] = useState(3),
    [hint, setHint] = useState(false),
    [source, setSource] = useState(false),
    [why, setWhy] = useState(false),
    [exit, setExit] = useState(false),
    [override, setOverride] = useState(false),
    [grading, setGrading] = useState(false),
    [selfFallback, setSelfFallback] = useState(false),
    [slow, setSlow] = useState(false),
    [error, setError] = useState(''),
    [completed, setCompleted] = useState<
      { rating: number; title: string; diagnosis: string | null; seconds: number }[]
    >([])
  const started = useRef(performance.now()),
    sessionStarted = useRef(performance.now()),
    measured = useRef<number | null>(null),
    locked = useRef(false),
    controller = useRef<AbortController | null>(null)
  const item = items[index],
    deck = data.decks.find((d) => d.id === deckId),
    current = data.concepts.find((c) => c.id === item?.card.id) ?? item?.card
  const selfMode = item?.answerType === 'self' || selfFallback
  useEffect(() => {
    started.current = performance.now()
    measured.current = null
    locked.current = false
    setRevealed(false)
    setAnswer('')
    setFeedback(null)
    setHint(false)
    setSelfFallback(false)
    setError('')
    setRating(3)
    setWhy(false)
    setSource(false)
  }, [index])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!grading) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(timer)
  }, [grading])
  function reveal() {
    measured.current ??= (performance.now() - started.current) / 1000
    setRevealed(true)
  }
  async function submit() {
    if (!item || !answer.trim() || locked.current || revealed) return
    locked.current = true
    measured.current ??= (performance.now() - started.current) / 1000
    const abort = new AbortController()
    controller.current = abort
    setGrading(true)
    setError('')
    try {
      const result = await client.grade(item, answer, abort.signal)
      if (abort.signal.aborted) return
      setFeedback(result)
      setRating(result.proposedRating)
      setRevealed(true)
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error ? error.message : 'No se pudo evaluar. Puedes calificarte tú.',
        )
    } finally {
      if (controller.current === abort) {
        locked.current = false
        setGrading(false)
      }
    }
  }
  function record(value: number) {
    if (!item || locked.current) return
    locked.current = true
    try {
      const seconds = measured.current ?? (performance.now() - started.current) / 1000
      const diagnosis = value === 1 ? (feedback?.diagnosis ?? 'Revisar la idea principal.') : null
      client.review(item.card.id, value, seconds, diagnosis)
      setCompleted((done) => [
        ...done,
        { rating: value, title: current?.title ?? item.card.title, diagnosis, seconds },
      ])
      if (feedback?.reinforcement && (value === 1 || value === 2)) {
        const reinforcement = feedback.reinforcement
        setItems((list) => [
          ...list.slice(0, index + 1),
          reinforcement,
          ...list.slice(index + 1).filter((existing) => existing.card.id !== reinforcement.card.id),
        ])
      }
      setIndex((i) => i + 1)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar.')
      locked.current = false
    }
  }
  function rate(value: number) {
    if (!revealed) return
    if (selfMode) record(value)
    else setRating(value)
  }
  function fallback() {
    controller.current?.abort()
    controller.current = null
    locked.current = false
    setGrading(false)
    setFeedback(null)
    setSelfFallback(true)
    reveal()
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (document.querySelector('dialog[open]')) return
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !revealed) {
          event.preventDefault()
          void submit()
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (item) setExit(true)
        else navigate(`/decks/${deckId}`)
        return
      }
      if (isEditable(event.target)) {
        if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement) && !revealed) {
          event.preventDefault()
          void submit()
        }
        return
      }
      if (!item) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setSource(true)
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        ui.openEditor({ cardId: item.card.id })
      }
      if (event.key.toLowerCase() === 'h' && item.hint && !revealed) {
        event.preventDefault()
        setHint(true)
      }
      if (['1', '2', '3', '4'].includes(event.key) && revealed && !grading) {
        event.preventDefault()
        rate(Number(event.key))
      }
      if (
        (event.key === ' ' || event.key === 'Enter') &&
        event.target instanceof HTMLElement &&
        event.target.closest('button,a,summary')
      )
        return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (grading) return
        if (!revealed) {
          if (selfMode) reveal()
          else void submit()
        } else if (!selfMode) record(rating)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [item, revealed, selfMode, answer, feedback, rating, grading])
  if (!deck) return <Navigate to="/decks" replace />
  if (!item) {
    const seconds = Math.round((performance.now() - sessionStarted.current) / 1000),
      accuracy = completed.length
        ? Math.round((completed.filter((c) => c.rating >= 3).length / completed.length) * 100)
        : 0
    return (
      <div className="session-summary">
        <span className="summary-glyph">
          <Icon name="check" />
        </span>
        <span className="eyebrow">{deck.name}</span>
        <h1>{completed.length ? 'Repaso terminado' : 'No hay tarjetas en este mazo'}</h1>
        <p className="muted">
          {completed.length
            ? 'Un poco más claro. Un poco más tuyo.'
            : 'Añade tu primera tarjeta para comenzar.'}
        </p>
        <div className="summary-numbers">
          <div>
            <strong>{completed.length}</strong>
            <span>Tarjetas repasadas</span>
          </div>
          <div>
            <strong>{accuracy}%</strong>
            <span>Autoevaluación positiva</span>
          </div>
          <div>
            <strong>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </strong>
            <span>Tiempo de sesión</span>
          </div>
        </div>
        {completed.some((c) => c.diagnosis) && (
          <section className="summary-errors">
            <h3>Tarjetas a reforzar</h3>
            {completed
              .filter((c) => c.diagnosis)
              .map((c, i) => (
                <p key={i}>
                  <strong>{c.title}</strong>
                  <span>{c.diagnosis}</span>
                </p>
              ))}
          </section>
        )}
        <p className="muted">
          {client.mode === 'local'
            ? 'Los próximos repasos se programarán al conectar el servicio.'
            : 'Mañana: 12 tarjetas por repasar · demostración'}
        </p>
        <div className="button-row">
          <Button variant="primary" onClick={() => navigate(`/decks/${deckId}`)}>
            Volver al mazo
          </Button>
          <Button onClick={() => ui.openEditor({ deckId })}>Añadir tarjeta</Button>
        </div>
      </div>
    )
  }
  const sourceText = current?.noteText ?? item.card.noteText,
    anchor = item.anchor,
    anchorAt = sourceText.indexOf(anchor)
  const remaining = items.slice(index).reduce(
    (counts, entry) => {
      const key = entry.card.state === 0 ? 'new' : entry.card.state === 2 ? 'due' : 'learning'
      counts[key]++
      return counts
    },
    { new: 0, learning: 0, due: 0 },
  )
  return (
    <div className="reviewer">
      <ProgressLine value={index} total={items.length} />
      <div className="reviewer-top">
        <Link
          to={`/decks/${deckId}`}
          onClick={(event) => {
            event.preventDefault()
            setExit(true)
          }}
        >
          <Icon name="back" />
          {deck.name}
        </Link>
        <span>
          {index + 1} / {items.length}
        </span>
        <div className="reviewer-top-actions">
          <Chip>
            {client.status === 'offline'
              ? 'Sin conexión'
              : client.status === 'no-key'
                ? 'Falta la API key'
                : client.status === 'generating'
                  ? 'Generando…'
                  : client.mode === 'mock'
                    ? 'Vista de diseño'
                    : 'Modo local'}
          </Chip>
          <IconButton name="close" label="Salir del repaso" onClick={() => setExit(true)} />
        </div>
      </div>
      <div className="reviewer-content">
        <div className="review-metadata">
          <span>{typeLabels[item.type]}</span>
          <span className="metadata-separator" />
          <DifficultyDots value={item.difficulty} />
          <IconButton name="info" label="¿Por qué me salió esto?" onClick={() => setWhy(true)} />
        </div>
        <article className={`study-card ${revealed ? 'is-revealed' : ''}`}>
          <div className="card-question">
            <Markdown
              text={item.variantId === null ? (current?.title ?? item.question) : item.question}
            />
          </div>
          {!revealed && item.answerType !== 'self' && (
            <div className="review-input">
              {item.answerType === 'mcq' ? (
                <div className="choices">
                  {item.choices.map((choice, i) => (
                    <button
                      key={choice}
                      className={`choice ${answer === String(i) ? 'selected' : ''}`}
                      aria-pressed={answer === String(i)}
                      onClick={() => setAnswer(String(i))}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      <Markdown text={choice} />
                      {answer === String(i) && <Icon name="check" />}
                    </button>
                  ))}
                </div>
              ) : item.answerType === 'open' ? (
                <label>
                  Tu respuesta
                  <textarea
                    autoFocus
                    rows={4}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Explica tu razonamiento con tus propias palabras…"
                  />
                </label>
              ) : (
                <label>
                  Tu respuesta
                  <input
                    autoFocus
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={
                      item.answerType === 'numeric'
                        ? 'Un número o una expresión'
                        : 'Completa la respuesta'
                    }
                  />
                </label>
              )}
            </div>
          )}
          {hint && item.hint && !revealed && (
            <Notice>
              <strong>Pista</strong>
              <Markdown text={item.hint} />
            </Notice>
          )}
          {grading && (
            <div className="grading-line" role="status">
              <Skeleton />
              <p>Evaluando tu respuesta…</p>
              {slow && (
                <Button variant="ghost" onClick={fallback}>
                  Calificarme yo
                </Button>
              )}
            </div>
          )}
          {error && (
            <Notice error>
              {error}
              <Button variant="ghost" onClick={fallback}>
                Calificarme yo
              </Button>
            </Notice>
          )}
          {revealed && (
            <div className="card-back reveal-motion">
              {feedback && <VerdictLine verdict={feedback.verdict} reason={feedback.reasoning} />}
              <span className="eyebrow">RESPUESTA</span>
              <Markdown text={item.variantId === null ? sourceText : item.answer} />
              {item.solution && (
                <details className="solution">
                  <summary>
                    Ver explicación paso a paso
                    <Icon name="chevron" />
                  </summary>
                  <Markdown text={item.solution} />
                </details>
              )}
              {feedback?.reinforcement && (
                <p className="reinforcement">
                  <Icon name="book" />
                  Refuerzo: {feedback.reinforcement.card.title} va a continuación si necesitas
                  repasarlo.
                </p>
              )}
            </div>
          )}
        </article>
        <div className="trust-row">
          <Button variant="ghost" onClick={() => setSource(true)}>
            <Icon name="note" />
            De tu nota<Keycap>N</Keycap>
          </Button>
          <Button variant="ghost" onClick={() => ui.openEditor({ cardId: item.card.id })}>
            <Icon name="edit" />
            Editar<Keycap>E</Keycap>
          </Button>
          {item.hint && !revealed && (
            <Button variant="ghost" disabled={hint} onClick={() => setHint(true)}>
              Pista<Keycap>H</Keycap>
            </Button>
          )}
          {revealed && feedback && (
            <Button variant="ghost" onClick={() => setOverride(true)}>
              No estoy de acuerdo
            </Button>
          )}
          {revealed && item.variantId && (
            <Button
              variant="ghost"
              onClick={() => {
                const result = client.report(item.variantId!)
                ui.toast(
                  result.retired
                    ? 'Error reportado. Esta versión se ha retirado.'
                    : 'Error reportado. Gracias por revisarla.',
                )
              }}
            >
              <Icon name="flag" />
              Reportar error
            </Button>
          )}
        </div>
      </div>
      <div className="reviewer-bottom">
        {revealed ? (
          <>
            <RatingGroup
              intervals={item.intervals}
              selected={selfMode ? undefined : rating}
              onRate={rate}
            />
            {!selfMode && (
              <div className="next-row">
                <span className="muted">
                  {ratingLabels[rating - 1]} · puedes cambiar la valoración
                </span>
                <Button variant="primary" onClick={() => record(rating)}>
                  Siguiente
                  <Icon name="next" />
                  <Keycap>↵</Keycap>
                </Button>
              </div>
            )}
          </>
        ) : (
          <Button
            variant="primary"
            className="reveal-button"
            disabled={!selfMode && !answer.trim()}
            loading={grading}
            onClick={() => (selfMode ? reveal() : void submit())}
          >
            {selfMode ? 'Mostrar respuesta' : 'Comprobar respuesta'}
            <Keycap>{selfMode ? 'Espacio' : '↵'}</Keycap>
          </Button>
        )}
        <Counts counts={remaining} active={item.card.state} />
      </div>
      {source && (
        <Modal sheet title="De tu nota" onClose={() => setSource(false)}>
          <span className="eyebrow">{deck.name}</span>
          <h2>{current?.title ?? item.card.title}</h2>
          <p className="muted">La fuente de esta tarjeta, escrita por ti.</p>
          {item.variantId && anchorAt >= 0 ? (
            <div className="source-passage">
              <Markdown text={sourceText.slice(0, anchorAt)} />
              <mark>{anchor}</mark>
              <Markdown text={sourceText.slice(anchorAt + anchor.length)} />
            </div>
          ) : (
            <Markdown text={sourceText} />
          )}
          <Button variant="ghost" onClick={() => ui.openEditor({ cardId: item.card.id })}>
            Editar tarjeta
          </Button>
        </Modal>
      )}
      {why && (
        <Modal title="¿Por qué me salió esto?" onClose={() => setWhy(false)}>
          <p>{item.reason}</p>
          <Chip>
            {typeLabels[item.type]} · dificultad {item.difficulty}/5
          </Chip>
        </Modal>
      )}
      {override && (
        <Modal title="Cambiar valoración" onClose={() => setOverride(false)}>
          <p>¿Cómo valorarías tu respuesta?</p>
          <div className="button-row">
            {[
              { verdict: 'fail', label: 'Incorrecto', rating: 1 },
              { verdict: 'partial', label: 'Casi', rating: 2 },
              { verdict: 'pass', label: 'Correcto', rating: 3 },
            ].map((option) => (
              <Button
                key={option.verdict}
                onClick={() => {
                  setFeedback((previous) =>
                    previous
                      ? {
                          ...previous,
                          verdict: option.verdict as Verdict,
                          reasoning: 'Valoración corregida por ti.',
                          proposedRating: option.rating,
                        }
                      : previous,
                  )
                  setRating(option.rating)
                  setOverride(false)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {exit && (
        <Modal title="¿Salir del repaso?" onClose={() => setExit(false)}>
          <p>
            Las {completed.length} tarjetas repasadas ya están guardadas. Puedes volver cuando
            quieras.
          </p>
          <div className="form-actions">
            <Button onClick={() => setExit(false)}>Seguir estudiando</Button>
            <Button variant="primary" onClick={() => navigate(`/decks/${deckId}`)}>
              Salir del repaso
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
