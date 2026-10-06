import { createDemoStore, samples, type Concept, type DemoData } from '../src/demo'
import { createLocalClient, recallCard } from './client'
import type { Connection, FlashcardClient, StudyCard, VariantType } from './types'
// This module is imported only behind import.meta.env.DEV. No fixtures ship in production.
export function installMock(params: URLSearchParams): FlashcardClient {
  const now = Date.now(),
    decks = ['Matemáticas', 'Biología', 'Español', 'Historia'].map((name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt: now,
    }))
  const concepts = decks.flatMap((deck, d) =>
    Array.from({ length: d === 0 ? 6 : 5 }, (_, i) => {
      const sample = samples[i % samples.length]
      return {
        ...sample,
        id: crypto.randomUUID(),
        deckId: deck.id,
        createdAt: now,
        title:
          d === 0
            ? sample.title
            : [
                'La célula y sus funciones',
                'El ADN y la herencia',
                'La fotosíntesis',
                'El sistema nervioso',
                'Los ecosistemas',
              ][i],
        state: (i < 2 ? 0 : i === 2 ? 1 : 2) as 0 | 1 | 2,
        due: i < 2 ? null : now - 1000,
        memory: i < 2 ? null : 0.63 + i * 0.06,
      }
    }),
  )
  const first = concepts[0],
    reviews = Array.from({ length: 24 }, (_, i) => ({
      id: crypto.randomUUID(),
      conceptId: concepts[i % concepts.length].id,
      rating: i % 7 === 0 ? 1 : 3,
      reviewedAt: now - (i % 7) * 86400000,
      seconds: 25,
      errorSummary: i % 7 === 0 ? 'Confunde catetos con hipotenusa.' : null,
    }))
  const fixtures: DemoData = { version: 2, decks, concepts, reviews }
  if (params.get('state') === 'empty')
    ((fixtures.decks = []), (fixtures.concepts = []), (fixtures.reviews = []))
  const store = createDemoStore({ getItem: () => JSON.stringify(fixtures), setItem: () => {} })
  const typeParam = params.get('variant')
  const requested = [
    'recall',
    'cloze',
    'mcq',
    'numeric_problem',
    'open_problem',
    'explain',
  ].includes(typeParam ?? '')
    ? (typeParam as VariantType)
    : null
  const reports = new Map<string, number>(),
    connections: Connection[] = [
      {
        id: crypto.randomUUID(),
        title: 'Raíz cuadrada y potencias',
        relation: 'prerequisite_of',
        status: 'confirmed',
        rationale: 'Te ayuda a calcular la hipotenusa.',
      },
      {
        id: crypto.randomUUID(),
        title: 'Distancia entre dos puntos',
        relation: 'application_of',
        status: 'suggested',
        rationale: 'Aplica el teorema para medir distancias.',
      },
    ]
  function variant(card: Concept = first, type: VariantType = requested ?? 'recall'): StudyCard {
    const base = {
      ...recallCard(card),
      variantId: `mock-${type}-${card.id}`,
      type,
      intervals: ['10 min', '2 d', '6 d', '15 d'] as [string, string, string, string],
      anchor: 'Si los catetos miden 3 y 4, la hipotenusa mide 5',
      hint: 'Identifica los dos catetos y eleva cada uno al cuadrado.',
      difficulty: 2,
      reason:
        'Es una tarjeta nueva. Empezamos con un ejemplo sencillo para afianzar la relación entre los catetos y la hipotenusa.',
      solution:
        '1. Eleva los catetos al cuadrado: $3^2=9$ y $4^2=16$.\n2. Suma: $9+16=25$.\n3. Calcula $c=\\sqrt{25}=5$.',
    }
    if (type === 'recall')
      return {
        ...base,
        answer:
          'En un triángulo rectángulo, la suma de los cuadrados de los catetos es igual al cuadrado de la hipotenusa.\n\n$$a^2+b^2=c^2$$',
      }
    if (type === 'cloze')
      return {
        ...base,
        question:
          'Completa la relación entre los catetos y la hipotenusa:\n\n$$a^2+b^2=\\underline{\\hspace{1.2cm}}$$',
        answerType: 'text',
        answer: '$c^2$',
        accepted: ['c²', 'c^2', 'c2'],
      }
    if (type === 'mcq')
      return {
        ...base,
        question:
          'Los catetos de un triángulo rectángulo miden **3** y **4**. ¿Cuánto mide la hipotenusa?',
        answerType: 'mcq',
        choices: ['4', '5', '7', '25'],
        answer: '5',
        accepted: ['1'],
      }
    if (type === 'numeric_problem')
      return {
        ...base,
        question:
          'Un triángulo rectángulo tiene catetos de **3 cm** y **4 cm**.\n\n¿Cuánto mide la hipotenusa?',
        answerType: 'numeric',
        answer: '$5\\text{ cm}$',
        accepted: ['5', '5.0', '10/2'],
      }
    return {
      ...base,
      question:
        type === 'explain'
          ? 'Explica con tus palabras qué relación establece el teorema de Pitágoras.'
          : '¿Cómo usarías el teorema de Pitágoras para calcular la hipotenusa si conoces los dos catetos?',
      answerType: 'open',
      answer:
        'Identifica los catetos, suma sus cuadrados y calcula la raíz cuadrada. La hipotenusa es el lado opuesto al ángulo recto.',
      rubric: ['Identifica los catetos.', 'Suma sus cuadrados.', 'Calcula la raíz cuadrada.'],
    }
  }
  const base = createLocalClient()
  const client: FlashcardClient = {
    ...base,
    ...store,
    mode: 'mock',
    status:
      params.get('state') === 'generating'
        ? 'generating'
        : params.get('state') === 'offline'
          ? 'offline'
          : params.get('state') === 'no-key'
            ? 'no-key'
            : 'idle',
    buildSession(deckId, effort, minutes) {
      const allowed =
        effort === 'quick'
          ? ['recall', 'cloze', 'mcq']
          : effort === 'normal'
            ? ['recall', 'cloze', 'mcq', 'numeric_problem']
            : ['recall', 'cloze', 'mcq', 'numeric_problem', 'open_problem', 'explain']
      return store
        .getSnapshot()
        .concepts.filter((c) => c.deckId === deckId)
        .slice(0, minutes === null ? undefined : Math.max(1, Math.floor((minutes * 60) / 30)))
        .map((card, i) => variant(card, requested ?? (allowed[i % allowed.length] as VariantType)))
        .filter((item) => (reports.get(item.variantId!) ?? 0) < 2)
    },
    async grade(item, answer, signal) {
      if (item.answerType === 'open')
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, params.get('state') === 'loading' ? 15000 : 350)
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true },
          )
        })
      const forced = params.get('state')
      const correct = item.accepted.length
        ? item.accepted.includes(answer.trim().toLowerCase())
        : answer.length > 25
      const verdict =
        forced === 'fail'
          ? 'fail'
          : forced === 'partial'
            ? 'partial'
            : forced === 'pass'
              ? 'pass'
              : correct
                ? 'pass'
                : 'fail'
      return {
        verdict,
        reasoning:
          verdict === 'pass'
            ? 'Has aplicado correctamente la relación entre los catetos y la hipotenusa.'
            : verdict === 'partial'
              ? 'La idea es correcta, pero falta explicar el último paso.'
              : 'Recuerda sumar los cuadrados de los catetos y después calcular la raíz cuadrada.',
        proposedRating: verdict === 'pass' ? 3 : verdict === 'partial' ? 2 : 1,
        missingCriteria: verdict === 'pass' ? [] : ['Calcular la raíz cuadrada.'],
        diagnosis: 'Confunde catetos con hipotenusa.',
        reinforcement:
          verdict === 'fail'
            ? {
                ...recallCard(concepts[1]),
                reason: 'Refuerzo: esta tarjeta es un prerrequisito que conviene repasar.',
              }
            : undefined,
      }
    },
    report(id) {
      const count = (reports.get(id) ?? 0) + 1
      reports.set(id, count)
      return { retired: count >= 2 }
    },
    connections() {
      return connections
    },
    setConnection(id, status) {
      const connection = connections.find((c) => c.id === id)
      if (connection) connection.status = status
    },
  }
  Object.defineProperty(window, 'api', { value: client, configurable: true })
  return client
}
