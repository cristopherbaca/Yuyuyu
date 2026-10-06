import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { deckCounts, type Deck } from '../../src/demo'
import { getClient, useCards } from '../../app/client'
import { useUI } from '../../app/ui'
import {
  Button,
  Counts,
  EmptyState,
  Icon,
  Modal,
  Notice,
  PageHeader,
} from '../../design-system/primitives'
export function DecksPage() {
  const data = useCards(),
    client = getClient(),
    ui = useUI(),
    navigate = useNavigate()
  const [edit, setEdit] = useState<Deck | 'new' | null>(null),
    [remove, setRemove] = useState<Deck | null>(null),
    [name, setName] = useState(''),
    [error, setError] = useState('')
  function save() {
    try {
      if (edit === 'new') {
        const deck = client.createDeck(name)
        ui.toast('Mazo creado')
        navigate(`/decks/${deck.id}`)
      } else if (edit) {
        client.renameDeck(edit.id, name)
        ui.toast('Nombre actualizado')
      }
      setEdit(null)
      setError('')
    } catch {
      setError('Escribe un nombre de entre 1 y 100 caracteres.')
    }
  }
  const totals = deckCounts(data)
  return (
    <>
      <PageHeader
        title="Mazos"
        description="Tus tarjetas, organizadas. Un mazo a la vez."
        action={
          <>
            <Button
              onClick={() => {
                setEdit('new')
                setName('')
                setError('')
              }}
            >
              <Icon name="plus" />
              Crear mazo
            </Button>
            <Button variant="primary" onClick={() => ui.openEditor()}>
              <Icon name="plus" />
              Añadir tarjeta
            </Button>
          </>
        }
      />
      {client.getWarning() && <Notice error>{client.getWarning()}</Notice>}
      {!data.decks.length ? (
        <EmptyState
          title="Crea tu primer mazo"
          description="Dale un lugar a lo que quieres recordar."
          action={
            <>
              <Button
                variant="primary"
                onClick={() => {
                  setEdit('new')
                  setName('')
                }}
              >
                Crear mazo
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  client.seed()
                  ui.toast('Tarjetas de ejemplo añadidas')
                }}
              >
                Cargar datos de ejemplo
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className="deck-list">
            <div className="deck-table-head">
              <span>Mazo</span>
              <span>Nuevas</span>
              <span>Aprendiendo</span>
              <span>Por repasar</span>
              <span />
            </div>
            {data.decks.map((deck) => (
              <div className="deck-row" key={deck.id}>
                <Link className="deck-name" to={`/decks/${deck.id}`}>
                  <span className="deck-glyph">
                    <Icon name="folder" />
                  </span>
                  <span>
                    <strong>{deck.name}</strong>
                    <small>
                      {data.concepts.filter((c) => c.deckId === deck.id).length} tarjetas
                    </small>
                  </span>
                </Link>
                <Counts counts={deckCounts(data, deck.id)} />
                <div className="deck-row-actions">
                  <Button className="hover-study" onClick={() => navigate(`/study/${deck.id}`)}>
                    Estudiar
                    <Icon name="next" />
                  </Button>
                  <details className="menu">
                    <summary aria-label={`Opciones de ${deck.name}`}>
                      <Icon name="more" />
                    </summary>
                    <div className="menu-content">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEdit(deck)
                          setName(deck.name)
                          setError('')
                        }}
                      >
                        <Icon name="edit" />
                        Renombrar
                      </Button>
                      <Button variant="ghost" onClick={() => setRemove(deck)}>
                        <Icon name="trash" />
                        Eliminar
                      </Button>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
          <footer className="deck-totals">
            <span>
              {data.concepts.length} tarjetas en {data.decks.length} mazos
            </span>
            <span>
              <strong>{totals.new + totals.learning + totals.due}</strong> tarjetas listas hoy
              <span className="muted"> · {totals.new} nuevas</span>
            </span>
          </footer>
          <p className="page-footnote">
            {client.mode === 'local'
              ? 'Práctica local · los intervalos se conectarán con la programación de repasos.'
              : 'Vista de diseño · datos de demostración.'}
          </p>
        </>
      )}
      {edit && (
        <Modal
          title={edit === 'new' ? 'Crear mazo' : 'Renombrar mazo'}
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <label>
              Nombre del mazo
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Por ejemplo, Matemáticas"
                maxLength={100}
                required
              />
            </label>
            {error && <Notice error>{error}</Notice>}
            <div className="form-actions">
              <Button onClick={() => setEdit(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">
                {edit === 'new' ? 'Crear mazo' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="Eliminar mazo" onClose={() => setRemove(null)}>
          <p>Se eliminarán «{remove.name}», sus tarjetas y su historial local.</p>
          <div className="form-actions">
            <Button onClick={() => setRemove(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                client.deleteDeck(remove.id)
                setRemove(null)
                ui.toast('Mazo eliminado')
              }}
            >
              Eliminar mazo
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
