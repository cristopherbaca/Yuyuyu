import { useSyncExternalStore } from 'react'
import { createDemoStore, type Concept, type StoragePort } from '../src/demo'
import type { FlashcardClient, StudyCard } from './types'
export function recallCard(card: Concept): StudyCard {
  return {
    card,
    variantId: null,
    type: 'recall',
    question: card.title,
    choices: [],
    answerType: 'self',
    answer: card.noteText,
    accepted: [],
    solution: '',
    hint: null,
    anchor: card.noteText,
    rubric: [],
    difficulty: 1,
    reason:
      'Práctica local de tu tarjeta. Las preguntas generadas estarán disponibles al conectar el servicio.',
    intervals: ['Sin programar', 'Sin programar', 'Sin programar', 'Sin programar'],
  }
}
export function createLocalClient(storage?: StoragePort): FlashcardClient {
  const store = createDemoStore(storage)
  return {
    ...store,
    mode: 'local',
    status: 'idle',
    buildSession(deckId, effort, minutes) {
      const seconds = { quick: 20, normal: 40, deep: 90 }[effort]
      return store
        .getSnapshot()
        .concepts.filter((c) => c.deckId === deckId)
        .slice(0, minutes === null ? undefined : Math.max(1, Math.floor((minutes * 60) / seconds)))
        .map(recallCard)
    },
    async grade() {
      throw new Error('La evaluación automática requiere conectar el servicio.')
    },
    report() {
      return { retired: false }
    },
    connections() {
      return []
    },
    setConnection() {},
  }
}
let storage: StoragePort | undefined
try {
  storage = window.localStorage
} catch {
  /* In-memory fallback stays usable. */
}
let activeClient = createLocalClient(storage)
export function setClient(client: FlashcardClient) {
  activeClient = client
}
export function getClient() {
  return activeClient
}
export function useCards() {
  return useSyncExternalStore(activeClient.subscribe, activeClient.getSnapshot)
}
