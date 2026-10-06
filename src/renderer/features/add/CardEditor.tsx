import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getClient, useCards } from '../../app/client'
import { useUI, type EditorRequest } from '../../app/ui'
import type { Mode } from '../../src/demo'
import { Button, Keycap, Modal, Notice, SegmentedControl } from '../../design-system/primitives'
import { Markdown } from '../../design-system/Markdown'
export function CardEditor({ request, onClose }: { request: EditorRequest; onClose(): void }) {
  const data = useCards(),
    client = getClient(),
    ui = useUI(),
    card = data.concepts.find((c) => c.id === request.cardId)
  const [deckId, setDeckId] = useState(card?.deckId ?? request.deckId ?? data.decks[0]?.id ?? ''),
    [title, setTitle] = useState(card?.title ?? ''),
    [note, setNote] = useState(card?.noteText ?? ''),
    [mode, setMode] = useState<Mode>(card?.modePref ?? 'both'),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(''),
    [newDeck, setNewDeck] = useState('')
  const form = useRef<HTMLFormElement>(null),
    front = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        form.current?.requestSubmit()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  function save(event: FormEvent) {
    event.preventDefault()
    try {
      const selected = deckId || client.createDeck(newDeck || 'General').id
      const input = { title, noteText: note, modePref: mode, deckId: selected }
      if (card) {
        client.update(card.id, input)
        ui.toast('Tarjeta actualizada')
        onClose()
      } else {
        client.create(input)
        setDeckId(selected)
        setTitle('')
        setNote('')
        setPreview(false)
        front.current?.focus()
        ui.toast('Tarjeta añadida · puedes añadir otra')
      }
      setError('')
    } catch {
      setError('Completa el frente, el reverso y un mazo válido.')
    }
  }
  return (
    <Modal title={card ? 'Editar tarjeta' : 'Añadir tarjeta'} wide onClose={onClose}>
      <form ref={form} onSubmit={save} className="card-editor">
        {error && <Notice error>{error}</Notice>}
        <label>
          Mazo
          {data.decks.length ? (
            <select value={deckId} onChange={(e) => setDeckId(e.target.value)} required>
              {data.decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={newDeck}
              onChange={(e) => setNewDeck(e.target.value)}
              placeholder="General"
              maxLength={100}
            />
          )}
        </label>
        <label>
          Frente
          <input
            ref={front}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="La pregunta o idea que quieres recordar"
          />
        </label>
        <div className="editor-back-heading">
          <label htmlFor="card-back">Reverso</label>
          <Button variant="ghost" aria-pressed={preview} onClick={() => setPreview(!preview)}>
            {preview ? 'Editar' : 'Vista previa'}
          </Button>
        </div>
        {preview ? (
          <div className="editor-preview">
            <Markdown text={note || '*Tu reverso aparecerá aquí.*'} />
          </div>
        ) : (
          <textarea
            id="card-back"
            rows={9}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={40000}
            placeholder="Escribe la respuesta. Admite Markdown y fórmulas como $a^2+b^2=c^2$."
          />
        )}
        <p className="helper-text">
          Escribe con tus palabras. Las preguntas se generan solo con lo que escribas en el reverso.
        </p>
        <div className="editor-mode">
          <span className="field-label">Modo de práctica</span>
          <SegmentedControl<Mode>
            label="Modo de práctica"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'problem', label: 'Problemas' },
              { value: 'both', label: 'Ambas' },
            ]}
          />
        </div>
        <footer className="form-actions">
          <Button onClick={onClose}>Cerrar</Button>
          <Button variant="primary" type="submit">
            {card ? 'Guardar cambios' : 'Añadir tarjeta'}
            <Keycap>⌘↵</Keycap>
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
