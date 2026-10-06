import {createContext,useContext,useEffect,useLayoutEffect,useState,type ReactNode} from 'react'
import type {StoragePort} from './demo'
export type Theme='light'|'dark'
export type ThemePreference=Theme|'system'
export const THEME_KEY='dynamic-flashcards.theme'
export function readPreference(storage:Pick<StoragePort,'getItem'>|undefined):ThemePreference {try{const value=storage?.getItem(THEME_KEY);if(value==='light'||value==='dark')return value}catch{/*Use system*/}return 'system'}
export function readTheme(storage:Pick<StoragePort,'getItem'>|undefined,prefersDark:boolean):Theme {const value=readPreference(storage);return value==='system'?(prefersDark?'dark':'light'):value}
const Context=createContext<{theme:Theme;preference:ThemePreference;setPreference(value:ThemePreference):void}|null>(null)
export function ThemeProvider({children}:{children:ReactNode}) {
 const [preference,setPreference]=useState<ThemePreference>(()=>{try{return readPreference(localStorage)}catch{return 'system'}})
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches)
 const theme=preference==='system'?(systemDark?'dark':'light'):preference
 useEffect(()=>{const query=window.matchMedia('(prefers-color-scheme: dark)');const change=()=>setSystemDark(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[])
 useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;try{localStorage.setItem(THEME_KEY,preference)}catch{/*Session preference remains usable*/}},[theme,preference])
 return <Context.Provider value={{theme,preference,setPreference}}>{children}</Context.Provider>
}
export function useTheme(){const value=useContext(Context);if(!value)throw new Error('ThemeProvider requerido.');return value}
