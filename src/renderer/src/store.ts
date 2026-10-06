import { useSyncExternalStore } from 'react'
import { createDemoStore, type StoragePort } from './demo'
let storage: StoragePort | undefined
try {
  storage = window.localStorage
} catch {
  /* The store keeps working in memory. */
}
export const demo = createDemoStore(storage)
export function useDemo() {
  return useSyncExternalStore(demo.subscribe, demo.getSnapshot)
}
