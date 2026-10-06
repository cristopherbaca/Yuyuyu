import {createContext,useContext,type ReactNode} from 'react'
export interface EditorRequest{cardId?:string;deckId?:string}
const Context=createContext<{openEditor(request?:EditorRequest):void;toast(message:string):void}|null>(null)
export function UIProvider({children,value}:{children:ReactNode;value:{openEditor(request?:EditorRequest):void;toast(message:string):void}}){return <Context.Provider value={value}>{children}</Context.Provider>}
export function useUI(){const value=useContext(Context);if(!value)throw new Error('UIProvider requerido.');return value}
export function isEditable(target:EventTarget|null){return target instanceof HTMLElement && (target.closest('input,textarea,select,[contenteditable="true"]')!==null)}
