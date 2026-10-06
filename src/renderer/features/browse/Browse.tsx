import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getClient, useCards } from '../../app/client'
import { useUI } from '../../app/ui'
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  MemoryMeter,
  Modal,
  Notice,
  PageHeader,
  PropertyRow,
  SegmentedControl,
} from '../../design-system/primitives'
import { Markdown } from '../../design-system/Markdown'
import { date } from '../../src/api'
export function BrowsePage() {
  const data = useCards(),
    client = getClient(),
    ui = useUI(),
    [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<string | null>(null),
    [remove, setRemove] = useState(false),
    [connectionRevision, setConnectionRevision] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null),
    deckId = params.get('deck') ?? ''
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  const rows = data.concepts.filter(
    (c) =>
      (!deckId || c.deckId === deckId) &&
      `${c.title} ${c.noteText}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) &&
      (filter === 'all' ||
        (filter === 'new' && c.state === 0) ||
        (filter === 'due' && c.due !== null && c.due <= Date.now()) ||
        (filter === 'weak' && c.memory !== null && c.memory < 0.8)),
  )
  const card = data.concepts.find((c) => c.id === selected),
    history = data.reviews
      .filter((r) => r.conceptId === selected)
      .slice(-8)
      .reverse()
  const connections = card ? client.connections(card.id) : []
  void connectionRevision
  return (
    <>
      <PageHeader
        title="Explorar"
        description={`${data.concepts.length} tarjetas. Encuentra lo que necesitas repasar.`}
        action={
          <Button variant="primary" onClick={() => ui.openEditor({ deckId: deckId || undefined })}>
            <Icon name="plus" />
            Añadir tarjeta
          </Button>
        }
      />
      <div className="browse-toolbar">
        <div className="search-input">
          <Icon name="search" />
          <input
            ref={searchRef}
            aria-label="Buscar tarjetas"
            placeholder="Buscar tarjetas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘F</kbd>
        </div>
        <select
          aria-label="Filtrar por mazo"
          value={deckId}
          onChange={(e) => setParams(e.target.value ? { deck: e.target.value } : {})}
        >
          <option value="">Todos los mazos</option>
          {data.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-strip"><SegmentedControl<string>
        label="Filtrar tarjetas"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'due', label: 'Vencen hoy' },
          { value: 'new', label: 'Nuevas' },
          { value: 'weak', label: 'Débiles' },
        ]}
      /></div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="card-table">
            <thead>
              <tr>
                <th>Frente</th>
                <th>Mazo</th>
                <th>Memoria</th>
                <th>Próximo repaso</th>
                <th>Estado</th>
                <th>Versiones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={selected === c.id ? 'selected' : ''}>
                  <td>
                    <button className="card-row-front" onClick={() => setSelected(c.id)}>
                      <strong>{c.title}</strong>
                      <span>{c.noteText.replace(/[#*$]/g, '').slice(0, 75)}</span>
                    </button>
                  </td>
                  <td>{data.decks.find((d) => d.id === c.deckId)?.name}</td>
                  <td>
                    <MemoryMeter value={c.memory} />
                  </td>
                  <td>
                    {c.due === null
                      ? 'Sin programar'
                      : c.due <= Date.now()
                        ? 'Hoy'
                        : new Date(c.due).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                          })}
                  </td>
                  <td>
                    <Chip tone={c.state === 0 ? 'new' : c.state === 2 ? 'due' : 'learning'}>
                      {c.state === 0 ? 'Nueva' : c.state === 2 ? 'Repaso' : 'Aprendiendo'}
                    </Chip>
                  </td>
                  <td className="tabular">{client.mode === 'mock' ? 6 : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={search || filter !== 'all' ? 'Sin resultados' : 'Aquí estarán tus tarjetas'}
          description={
            search || filter !== 'all'
              ? 'Prueba otra búsqueda o cambia los filtros.'
              : 'Añade una tarjeta para empezar a explorar.'
          }
          action={<Button onClick={() => ui.openEditor()}>Añadir tarjeta</Button>}
        />
      )}
      {card && (
        <Modal
          sheet
          title="Detalle de tarjeta"
          onClose={() => {
            setSelected(null)
            setRemove(false)
          }}
        >
          <div className="detail-heading">
            <span className="eyebrow">{data.decks.find((d) => d.id === card.deckId)?.name}</span>
            <h2>{card.title}</h2>
            <IconButton
              name="edit"
              label="Editar tarjeta"
              onClick={() => ui.openEditor({ cardId: card.id })}
            />
          </div>
          <Markdown text={card.noteText} />
          <div className="detail-properties">
            <PropertyRow label="Memoria">
              <MemoryMeter value={card.memory} />
            </PropertyRow>
            <PropertyRow label="Próximo repaso">
              {card.due === null ? 'Sin programar' : date(card.due)}
            </PropertyRow>
            <PropertyRow label="Banco de versiones">
              {client.mode === 'mock' ? '6 verificadas' : 'Tu nota está disponible'}
            </PropertyRow>
          </div>
          <section className="detail-section">
            <h3>Conexiones</h3>
            {connections.length ? (
              connections
                .filter((c) => c.status !== 'rejected')
                .map((connection) => (
                  <div className="connection" key={connection.id}>
                    <span>
                      <Icon name="book" />
                      <strong>{connection.title}</strong>
                    </span>
                    <Chip>{connection.status === 'confirmed' ? 'Confirmada' : 'Sugerida'}</Chip>
                    <p>{connection.rationale}</p>
                    {connection.status === 'suggested' && (
                      <div className="button-row">
                        <Button
                          onClick={() => {
                            client.setConnection(connection.id, 'confirmed')
                            setConnectionRevision((r) => r + 1)
                          }}
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            client.setConnection(connection.id, 'rejected')
                            setConnectionRevision((r) => r + 1)
                          }}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))
            ) : (
              <p className="muted">Las conexiones aparecerán al conectar el servicio.</p>
            )}
          </section>
          <section className="detail-section">
            <h3>Historial</h3>
            {history.length ? (
              history.map((r) => (
                <div className="timeline-item" key={r.id}>
                  <i />
                  <div>
                    <strong>{['Otra vez', 'Difícil', 'Bien', 'Fácil'][r.rating - 1]}</strong>
                    <time>{date(r.reviewedAt)}</time>
                    <p>{r.errorSummary ?? 'Autoevaluación de tu tarjeta.'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Aún no has repasado esta tarjeta.</p>
            )}
          </section>
          {remove ? (
            <Notice>
              <p>¿Eliminar esta tarjeta y su historial?</p>
              <div className="button-row">
                <Button
                  variant="danger"
                  onClick={() => {
                    client.delete(card.id)
                    setSelected(null)
                    setRemove(false)
                    ui.toast('Tarjeta eliminada')
                  }}
                >
                  Eliminar tarjeta
                </Button>
                <Button onClick={() => setRemove(false)}>Cancelar</Button>
              </div>
            </Notice>
          ) : (
            <Button variant="ghost" onClick={() => setRemove(true)}>
              <Icon name="trash" />
              Eliminar tarjeta
            </Button>
          )}
        </Modal>
      )}
    </>
  )
}
