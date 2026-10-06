import { useEffect, useRef, useState } from 'react'
import type { AnswerReveal, Effort, ReviewResult, SessionItem, Verdict } from '../../shared/domain'
import { date, message, unwrap } from './api'
import { ErrorBox, Icon, Markdown, Notice, PageHeader } from './components'
const typeLabels = {
  recall: 'Recuerdo',
  cloze: 'Completar',
  mcq: 'Elección múltiple',
  numeric_problem: 'Problema numérico',
  open_problem: 'Aplicación',
  explain: 'Explicación',
}
const ratingLabels = ['Otra vez', 'Difícil', 'Bien', 'Fácil']
export function StudyPage() {
  const [effort, setEffort] = useState<Effort>('normal')
  const [minutes, setMinutes] = useState(10)
  const [items, setItems] = useState<SessionItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [hint, setHint] = useState(false)
  const [reveal, setReveal] = useState<AnswerReveal | null>(null)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [override, setOverride] = useState(false)
  const [openOffline, setOpenOffline] = useState(false)
  const started = useRef(performance.now())
  const elapsed = useRef<number | null>(null)
  const busyRef = useRef(false)
  const item = items?.[index]
  useEffect(() => {
    started.current = performance.now()
    elapsed.current = null
    setAnswer('')
    setHint(false)
    setReveal(null)
    setResult(null)
    setError('')
    setInfo('')
    setOverride(false)
    setOpenOffline(false)
  }, [index, items === null])
  async function build() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const session = await unwrap(window.api.session.build({ effort, minutes }))
      setItems(session)
      setIndex(0)
      started.current = performance.now()
      elapsed.current = null
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  async function show() {
    if (!item || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    elapsed.current ??= Math.round(performance.now() - started.current)
    try {
      setReveal(
        await unwrap(
          window.api.reviews.reveal({ conceptId: item.conceptId, variantId: item.variantId }),
        ),
      )
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  async function submit(selfRating?: number) {
    if (!item || busyRef.current || result || (selfRating === undefined && !answer.trim())) return
    busyRef.current = true
    setBusy(true)
    setError('')
    elapsed.current ??= Math.round(performance.now() - started.current)
    try {
      const feedback = await unwrap(
        window.api.reviews.submit({
          conceptId: item.conceptId,
          variantId: item.variantId,
          userAnswer: answer,
          selfRating,
          responseTimeMs: Math.min(86400000, elapsed.current),
          hintUsed: hint,
        }),
      )
      setResult(feedback)
      setReveal(feedback)
      if (feedback.followUp)
        setItems((current) =>
          current
            ? [
                ...current.slice(0, index + 1),
                feedback.followUp!,
                ...current
                  .slice(index + 1)
                  .filter((existing) => existing.conceptId !== feedback.followUp!.conceptId),
              ]
            : current,
        )
    } catch (error) {
      setError(message(error))
      if (item.answerType === 'open') setOpenOffline(true)
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  const selfMode =
    item?.answerType === 'self' ||
    (item?.effort === 'quick' && reveal !== null) ||
    (openOffline && reveal !== null)
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (!item || event.ctrlKey || event.metaKey || event.altKey || busyRef.current || busy) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setItems(null)
        setIndex(0)
        return
      }
      const editable =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      if (editable) {
        if (
          event.key === 'Enter' &&
          !(event.target instanceof HTMLTextAreaElement) &&
          !result &&
          !reveal
        ) {
          event.preventDefault()
          void submit()
        }
        return
      }
      if (event.key.toLowerCase() === 'h' && item.hint && !result) {
        event.preventDefault()
        setHint(true)
      }
      if (['1', '2', '3', '4'].includes(event.key) && selfMode && reveal && !result) {
        event.preventDefault()
        void submit(Number(event.key))
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (result) setIndex((value) => value + 1)
        else if (selfMode && !reveal) void show()
        else if (!reveal) void submit()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  async function changeVerdict(verdict: Verdict) {
    if (!result) return
    setBusy(true)
    setError('')
    try {
      const changed = await unwrap(window.api.reviews.override(result.reviewId, verdict))
      setResult({
        ...result,
        verdict,
        rating: changed.rating,
        nextDue: changed.nextDue,
        feedback: 'Valoración corregida por ti.',
      })
      setOverride(false)
      setItems((current) => {
        if (!current) return current
        const pending = current
          .slice(index + 1)
          .filter(
            (existing) =>
              !existing.selectionReason.startsWith(`Refuerzo: fallaste ${item?.title}`) &&
              existing.conceptId !== changed.followUp?.conceptId,
          )
        return [
          ...current.slice(0, index + 1),
          ...(changed.followUp ? [changed.followUp] : []),
          ...pending,
        ]
      })
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  async function report() {
    if (!item?.variantId) return
    setBusy(true)
    try {
      const value = await unwrap(window.api.variants.report(item.variantId))
      setInfo(
        value.status === 'retired'
          ? 'Variante retirada. Gracias por mejorar el banco.'
          : 'Reporte guardado. El segundo reporte retira la variante.',
      )
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  if (!items)
    return (
      <>
        <PageHeader
          eyebrow="UN POCO CADA DÍA"
          title="Hoy, una nueva perspectiva."
          description="Repasa lo que toca. Cada pregunta es otra forma de entenderlo."
        />
        <ErrorBox error={error} />
        <div className="study-setup panel">
          <div className="study-illustration">
            <div className="floating-card rear">
              <span>RECUERDA</span>
              <p>Una idea.</p>
            </div>
            <div className="floating-card front">
              <Icon name="spark" />
              <span>COMPRENDE</span>
              <p>
                Muchas
                <br />
                perspectivas.
              </p>
              <div className="card-line" />
            </div>
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
          <div className="setup-controls">
            <span className="eyebrow">TU SESIÓN</span>
            <h2>¿Cómo quieres practicar?</h2>
            <div className="effort-options">
              {(
                [
                  {
                    value: 'quick',
                    label: 'Rápido',
                    detail: 'Recordar · completar · elegir',
                    time: '20–30 s / pregunta',
                  },
                  {
                    value: 'normal',
                    label: 'Normal',
                    detail: 'Añade problemas numéricos',
                    time: 'Hasta 90 s / pregunta',
                  },
                  {
                    value: 'deep',
                    label: 'Profundo',
                    detail: 'Aplicar · explicar con tus palabras',
                    time: 'Hasta 3 min / pregunta',
                  },
                ] as const
              ).map((option) => (
                <button
                  className={`effort-option ${effort === option.value ? 'selected' : ''}`}
                  key={option.value}
                  onClick={() => setEffort(option.value)}
                >
                  <span className="radio" />
                  <div>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </div>
                  <span className="option-time">{option.time}</span>
                </button>
              ))}
            </div>
            <label className="minutes-label">
              Tengo{' '}
              <input
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />{' '}
              minutos
            </label>
            <button className="primary wide" onClick={() => void build()} disabled={busy}>
              {busy ? 'Preparando sesión…' : 'Empezar a estudiar'}
              <Icon name="arrow" />
            </button>
            <p className="tiny muted">
              Tu nota siempre está disponible si faltan variantes. FSRS decide cuándo repasar.
            </p>
          </div>
        </div>
      </>
    )
  if (!item)
    return (
      <>
        <PageHeader
          eyebrow="SESIÓN COMPLETADA"
          title={items.length ? 'Un paso más cerca.' : 'Por hoy, todo al día.'}
          description={
            items.length
              ? `Has completado ${items.length} repasos. El próximo encuentro ya está programado.`
              : 'No hay conceptos pendientes que quepan en esta sesión. Añade una nota o vuelve más tarde.'
          }
        />
        <div className="empty panel">
          <div className="empty-icon">
            <Icon name="spark" />
          </div>
          <h2>
            {items.length ? 'Dale tiempo a lo que aprendiste.' : 'El descanso también cuenta.'}
          </h2>
          <p>El espaciado hace el resto.</p>
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
  const displayAnswer = (answerText: string) =>
    item.answerType === 'mcq' && item.choices
      ? (item.choices[Number(answerText)] ?? answerText)
      : answerText
  return (
    <>
      <div className="session-top">
        <span className="eyebrow">
          ENFOQUE{' '}
          {item.effort === 'quick' ? 'RÁPIDO' : item.effort === 'normal' ? 'NORMAL' : 'PROFUNDO'}
        </span>
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
      <div className="progress">
        <div style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <ErrorBox error={error} />
      {info && <Notice>{info}</Notice>}
      <section className="review-card panel">
        <div className="section-title">
          <span className="badge">{typeLabels[item.type]}</span>
          <span className="muted">{item.title}</span>
        </div>
        <div className="review-question">
          <Markdown text={item.questionMd} />
        </div>
        {!reveal && (
          <>
            {item.answerType === 'mcq' ? (
              <div className="choices">
                {item.choices?.map((choice, i) => (
                  <button
                    key={i}
                    className={`choice ${answer === String(i) ? 'selected' : ''}`}
                    onClick={() => setAnswer(String(i))}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    <Markdown text={choice} />
                  </button>
                ))}
              </div>
            ) : item.answerType === 'open' ? (
              <label>
                Tu explicación
                <textarea
                  rows={5}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Razona con tus propias palabras…"
                />
              </label>
            ) : item.answerType !== 'self' ? (
              <label>
                Tu respuesta
                <input
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    item.answerType === 'numeric'
                      ? 'Un número o expresión, por ejemplo 10/2'
                      : 'Completa la respuesta…'
                  }
                />
              </label>
            ) : (
              <p className="muted">
                Intenta recordar antes de mirar. Después, valora cuánto te costó.
              </p>
            )}
            {hint && item.hint && (
              <Notice>
                <Markdown text={item.hint} />
              </Notice>
            )}
            <div className="review-actions">
              {item.hint && (
                <button
                  className="text-button"
                  disabled={hint || busy}
                  onClick={() => setHint(true)}
                >
                  Ver pista <kbd>H</kbd>
                </button>
              )}
              <div className="grow" />
              {item.answerType === 'self' ? (
                <button className="primary" disabled={busy} onClick={() => void show()}>
                  Mostrar respuesta <kbd>Espacio</kbd>
                </button>
              ) : (
                <>
                  <button
                    className="primary"
                    disabled={busy || !answer.trim()}
                    onClick={() => void submit()}
                  >
                    {busy ? 'Evaluando…' : 'Comprobar'} <kbd>Enter</kbd>
                  </button>
                  {(item.effort === 'quick' || openOffline) && (
                    <button disabled={busy} onClick={() => void show()}>
                      Mostrar y autoevaluar
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
        <details className="why">
          <summary>¿Por qué me salió esto?</summary>
          <p>{item.selectionReason}</p>
        </details>
      </section>
      {reveal && (
        <>
          <div className="answer-columns">
            <section className="panel answer-panel">
              {result && (
                <div className={`feedback verdict-${result.verdict}`}>
                  <span>
                    {result.verdict === 'pass'
                      ? '✓ Bien hecho'
                      : result.verdict === 'partial'
                        ? '≈ Casi lo tienes'
                        : '↻ Vamos a reforzarlo'}
                  </span>
                  <p>{result.feedback}</p>
                  {result.missingCriteria.length > 0 && (
                    <ul>
                      {result.missingCriteria.map((criterion, i) => (
                        <li key={i}>{criterion}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <span className="eyebrow">
                RESPUESTA VERIFICADA{item.variantId === null ? ' · TU NOTA' : ''}
              </span>
              <Markdown text={displayAnswer(reveal.correctAnswer)} />
              {reveal.solutionStepsMd && (
                <>
                  <h3>Paso a paso</h3>
                  <Markdown text={reveal.solutionStepsMd} />
                </>
              )}
            </section>
            <section className="panel original-note">
              <span className="eyebrow">CONTRASTA CON TU NOTA</span>
              <Markdown text={reveal.noteText} />
            </section>
          </div>
          {!result ? (
            <div className="rating-panel">
              <p>¿Cuánto te costó recordarlo?</p>
              <div className="rating-buttons">
                {ratingLabels.map((label, i) => (
                  <button
                    key={label}
                    disabled={busy}
                    className={`rating rating-${i + 1}`}
                    onClick={() => void submit(i + 1)}
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
                <span className="muted">Próximo repaso</span>
                <strong>{date(result.nextDue)}</strong>
                <small>FSRS · {ratingLabels[result.rating - 1]}</small>
              </div>
              <div className="button-row">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setOverride(!override)}
                >
                  No estoy de acuerdo
                </button>
                {item.variantId && (
                  <button className="text-button" disabled={busy} onClick={() => void report()}>
                    Reportar error
                  </button>
                )}
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  {index + 1 === items.length ? 'Terminar sesión' : 'Siguiente'}
                  <Icon name="arrow" />
                </button>
              </div>
              {override && (
                <div className="override-options">
                  <p>Mi valoración correcta es:</p>
                  {(
                    [
                      { value: 'fail', label: 'Incorrecta' },
                      { value: 'partial', label: 'Parcial' },
                      { value: 'pass', label: 'Correcta' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      disabled={busy}
                      onClick={() => void changeVerdict(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
