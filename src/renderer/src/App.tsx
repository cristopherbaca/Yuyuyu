import { useEffect, useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router'
import type { LlmStatus } from '../../shared/domain'
import { ConceptsPage, ConceptDetailPage } from './Concepts'
import { StudyPage } from './Study'
import { StatsPage } from './Stats'
import { SettingsPage } from './Settings'
import { Icon } from './components'
const statusLabels = { idle: 'Banco listo', generating: 'Generando variantes…', offline: 'Sin conexión · banco local', 'no-key': 'Configura clave y modelos' }
export function App() {
  const [status, setStatus] = useState<LlmStatus>('idle'); const [fake, setFake] = useState(false)
  useEffect(() => {
    const unsubscribe = window.api.onLlmStatus(value => setStatus(value))
    // settings.get emits current status. Avoid requesting it inside the event listener (feedback loop).
    void window.api.settings.get().then(result => { if (result.ok) { setFake(result.data.fakeLlm); if (!result.data.fakeLlm && (!result.data.apiKeySet || !result.data.modelGenerate || !result.data.modelVerify)) setStatus('no-key') } })
    return unsubscribe
  }, [])
  return <HashRouter><div className="app-shell"><aside className="sidebar"><NavLink className="brand" to="/concepts"><span className="brand-mark"><Icon name="spark" /></span><div>Dynamic<span>FLASHCARDS</span></div></NavLink><div className="sidebar-caption">APRENDE LA IDEA.</div><nav aria-label="Navegación principal"><NavLink to="/concepts"><Icon name="cards" />Conceptos</NavLink><NavLink to="/study"><Icon name="study" />Estudiar</NavLink><NavLink to="/stats"><Icon name="stats" />Estadísticas</NavLink><NavLink to="/settings"><Icon name="settings" />Ajustes</NavLink></nav><div className="sidebar-bottom"><div className="local-badge"><i className="dot" /> Local y privado</div><p>La pregunta cambia.<br />El conocimiento se queda.</p><span className="version">v0.1 · FSRS</span></div></aside><div className="main-shell"><div className="topbar"><span>Tu espacio de aprendizaje</span><span className={`status-chip status-${status}`}><i className="dot" />{fake && status === 'idle' ? 'Simulación · sin conexión' : statusLabels[status]}</span></div><main><Routes><Route path="/concepts" element={<ConceptsPage />} /><Route path="/concepts/:id" element={<ConceptDetailPage />} /><Route path="/study" element={<StudyPage />} /><Route path="/stats" element={<StatsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/concepts" replace />} /></Routes></main></div></div></HashRouter>
}
