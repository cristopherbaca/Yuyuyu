import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getClient, useCards } from '../../app/client'
import { deckCounts } from '../../src/demo'
import type { Effort } from '../../app/types'
import { isEditable, useUI } from '../../app/ui'
import {
  Button,
  Chip,
  Counts,
  EmptyState,
  Icon,
  Keycap,
  PageHeader,
  Pill,
  SegmentedControl,
} from '../../design-system/primitives'
export const effortOptions = [
  { value: 'quick', label: 'Rápido' },
  { value: 'normal', label: 'Normal' },
  { value: 'deep', label: 'Profundo' },
] as const
export function OverviewPage() {
  const { deckId = '' } = useParams(),
    data = useCards(),
    client = getClient(),
    ui = useUI(),
    navigate = useNavigate(),
    deck = data.decks.find((d) => d.id === deckId)
  const [effort, setEffort] = useState<Effort>('normal'),
    [minutes, setMinutes] = useState<number | null>(10)
  const cards = data.concepts.filter((c) => c.deckId === deckId)
  const start = () => navigate(`/study/${deckId}?effort=${effort}&minutes=${minutes ?? 'all'}`)
  useEffect(() => {
    if (deck) {
      try {
        localStorage.setItem('mnemo.last-deck', deck.id)
      } catch {
        /*Session still works*/
      }
    }
  }, [deck?.id])
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.repeat || isEditable(event.target) || document.querySelector('dialog[open]')) return
      if (
        (event.key === ' ' || event.key === 'Enter') &&
        event.target instanceof HTMLElement &&
        event.target.closest('button,a,summary')
      )
        return
      if ((event.key === ' ' || event.key === 'Enter') && cards.length) {
        event.preventDefault()
        start()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [deckId, effort, minutes, cards.length])
  if (!deck)
    return (
      <EmptyState
        title="Mazo no encontrado"
        description="Vuelve a tus mazos para elegir otro."
        action={<Link to="/decks">Volver a Mazos</Link>}
      />
    )
  return (
    <>
      <PageHeader
        title={deck.name}
        breadcrumb={
          <Link to="/decks">
            <Icon name="back" />
            Mazos
          </Link>
        }
        action={
          <Button onClick={() => ui.openEditor({ deckId })}>
            <Icon name="plus" />
            Añadir tarjeta
          </Button>
        }
      />
      <div className="overview">
        <div className="overview-label">LISTO PARA TU PRÓXIMO REPASO</div>
        <Counts large counts={deckCounts(data, deckId)} />
        <Button
          variant="primary"
          className="study-primary"
          disabled={!cards.length}
          onClick={start}
        >
          Estudiar ahora
          <Icon name="next" />
          <Keycap>↵</Keycap>
        </Button>
        <p className="muted overview-total">
          {cards.length
            ? `${cards.length} tarjetas en este mazo`
            : 'Añade tu primera tarjeta para empezar.'}
        </p>
        <div className="study-options">
          <div>
            <span className="field-label">Ritmo</span>
            <SegmentedControl<Effort>
              label="Ritmo de estudio"
              value={effort}
              onChange={setEffort}
              options={effortOptions}
            />
            <p className="option-description">
              {effort === 'quick'
                ? 'Un repaso breve y directo.'
                : effort === 'normal'
                  ? 'Un equilibrio entre recordar y pensar.'
                  : 'Tiempo para razonar con calma.'}
            </p>
          </div>
          <div>
            <span className="field-label">Tiempo disponible</span>
            <div className="time-pills">
              {[5, 10, 20, null].map((value) => (
                <Pill
                  key={value ?? 'all'}
                  selected={minutes === value}
                  onClick={() => setMinutes(value)}
                >
                  {value === null ? 'Todas' : `${value} min`}
                </Pill>
              ))}
            </div>
          </div>
        </div>
        <div className="overview-bottom">
          <span>
            {client.mode === 'mock'
              ? 'Banco de versiones: 6 verificadas listas'
              : 'De tu nota · siempre disponible'}
          </span>
          <Chip>{client.mode === 'mock' ? 'Vista de diseño' : 'Modo local'}</Chip>
        </div>
        <div className="overview-links">
          <Button variant="ghost" onClick={() => ui.openEditor({ deckId })}>
            Añadir tarjeta
          </Button>
          <Link to={`/browse?deck=${deckId}`}>
            Explorar este mazo
            <Icon name="right" />
          </Link>
        </div>
      </div>
    </>
  )
}
