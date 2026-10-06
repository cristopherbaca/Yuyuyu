import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'
import type { StoragePort } from './demo'
export type Theme = 'light' | 'dark'
export const THEME_KEY = 'dynamic-flashcards.theme'
export function readTheme(
  storage: Pick<StoragePort, 'getItem'> | undefined,
  prefersDark: boolean,
): Theme {
  try {
    const saved = storage?.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* Use system preference. */
  }
  return prefersDark ? 'dark' : 'light'
}
function initialTheme() {
  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    /* Use system preference. */
  }
  return readTheme(storage, window.matchMedia('(prefers-color-scheme: dark)').matches)
}
const ThemeContext = createContext<{ theme: Theme; setTheme(theme: Theme): void } | null>(null)
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* Theme still works for this session. */
    }
  }, [theme])
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('ThemeProvider requerido.')
  return value
}
