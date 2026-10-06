import type { Concept, DemoData, DemoReview } from '../src/demo'
export type Effort='quick'|'normal'|'deep'
export type VariantType='recall'|'cloze'|'mcq'|'numeric_problem'|'open_problem'|'explain'
export type Verdict='fail'|'partial'|'pass'
export interface StudyCard { card:Concept; variantId:string|null; type:VariantType; question:string; choices:string[]; answerType:'self'|'text'|'numeric'|'mcq'|'open'; answer:string; accepted:string[]; solution:string; hint:string|null; anchor:string; rubric:string[]; difficulty:number; reason:string; intervals:[string,string,string,string] }
export interface Feedback { verdict:Verdict; reasoning:string; proposedRating:number; missingCriteria:string[]; reinforcement?:StudyCard; diagnosis?:string }
export interface Connection { id:string; title:string; relation:string; status:'confirmed'|'suggested'|'rejected'; rationale:string }
export interface FlashcardClient {
 getSnapshot():DemoData; subscribe(listener:()=>void):()=>void; getWarning():string
 createDeck(name:string):{id:string}; renameDeck(id:string,name:string):void; deleteDeck(id:string):void
 create(input:{title:string;noteText:string;modePref:'simple'|'problem'|'both';deckId?:string}):Concept
 update(id:string,input:{title:string;noteText:string;modePref:'simple'|'problem'|'both';deckId?:string}):void
 delete(id:string):void; seed():number; export():string
 review(id:string,rating:number,seconds?:number,errorSummary?:string|null):DemoReview
 buildSession(deckId:string,effort:Effort,minutes:number|null):StudyCard[]
 grade(item:StudyCard,answer:string,signal:AbortSignal):Promise<Feedback>
 report(id:string):{retired:boolean}; connections(id:string):Connection[]; setConnection(id:string,status:'confirmed'|'rejected'):void
 mode:'local'|'mock'; status:'idle'|'generating'|'offline'|'no-key'
}
export const typeLabels:Record<VariantType,string>={recall:'Recuerdo',cloze:'Completar',mcq:'Elección múltiple',numeric_problem:'Problema numérico',open_problem:'Aplicación',explain:'Explicación'}
export const ratingLabels=['Otra vez','Difícil','Bien','Fácil']
