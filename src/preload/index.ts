import { contextBridge, ipcRenderer } from 'electron'
import { eventSchemas, type Api, type Channel, type Payload, type Responses } from '../shared/ipc'
import type { Result } from '../shared/domain'
function invoke<C extends Channel>(channel: C, payload: Payload<C>): Promise<Result<Responses[C]>> {
  return ipcRenderer.invoke(channel, payload)
}
function subscribe<E extends keyof typeof eventSchemas>(
  channel: E,
  callback: (value: import('zod').z.infer<(typeof eventSchemas)[E]>) => void,
) {
  const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
    const parsed = eventSchemas[channel].safeParse(value)
    if (parsed.success) callback(parsed.data as import('zod').z.infer<(typeof eventSchemas)[E]>)
  }
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
const api: Api = {
  concepts: {
    create: (input) => invoke('concepts:create', input),
    list: () => invoke('concepts:list', null),
    get: (id) => invoke('concepts:get', id),
    update: (id, changes) => invoke('concepts:update', { id, changes }),
    delete: (id) => invoke('concepts:delete', id),
    generate: (id, n) => invoke('concepts:generate', { id, n }),
  },
  edges: {
    confirm: (id) => invoke('edges:confirm', id),
    reject: (id) => invoke('edges:reject', id),
  },
  session: { build: (input) => invoke('session:build', input) },
  reviews: {
    submit: (input) => invoke('reviews:submit', input),
    reveal: (input) => invoke('reviews:reveal', input),
    override: (reviewId, verdict) => invoke('reviews:override', { reviewId, verdict }),
  },
  variants: { report: (id) => invoke('variants:report', id) },
  jobs: { refillNow: () => invoke('jobs:refillNow', null) },
  stats: { get: () => invoke('stats:get', null) },
  data: { export: () => invoke('data:export', null), seed: () => invoke('data:seed', null) },
  settings: {
    get: () => invoke('settings:get', null),
    set: (input) => invoke('settings:set', input),
    setApiKey: (key) => invoke('settings:setApiKey', key),
  },
  openExternal: (url) => invoke('app:openExternal', url),
  onPoolUpdated: (listener) => subscribe('pool:updated', listener),
  onLlmStatus: (listener) => subscribe('llm:status', listener),
}
contextBridge.exposeInMainWorld('api', api)
