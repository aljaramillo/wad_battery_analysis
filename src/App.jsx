import { useState, useMemo, useCallback } from 'react'
import FileUploader from './components/FileUploader'
import ComparisonView from './components/ComparisonView'
import StatisticsPanel from './components/StatisticsPanel'
import DataTable from './components/DataTable'
import './App.css'

function App() {
  const [sessions, setSessions] = useState([])
  const [selectedSessionKeys, setSelectedSessionKeys] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleFilesLoaded = useCallback((newSessions) => {
    const sessionsWithNames = newSessions.map(session => ({
      ...session,
      sessionKey: session.sessionKey || session.fileName,
      customName: session.summary.customName || session.customName || session.id || '',
      notes: session.summary.notes || session.notes || ''
    }))
    
    // Ordenar por fecha y hora (más antigua primero)
    sessionsWithNames.sort((a, b) => {
      const dateTimeA = new Date(`${a.summary.surgeryDate || '1/1/1970'} ${a.summary.startTime || '00:00:00'}`)
      const dateTimeB = new Date(`${b.summary.surgeryDate || '1/1/1970'} ${b.summary.startTime || '00:00:00'}`)
      return dateTimeA - dateTimeB
    })
    
    setSessions(prev => {
      const mergedByKey = new Map(prev.map(session => [session.sessionKey, session]))
      sessionsWithNames.forEach(session => {
        mergedByKey.set(session.sessionKey, session)
      })
      const combined = Array.from(mergedByKey.values())
      // Reordenar todo el array por fecha y hora
      combined.sort((a, b) => {
        const dateTimeA = new Date(`${a.summary.surgeryDate || '1/1/1970'} ${a.summary.startTime || '00:00:00'}`)
        const dateTimeB = new Date(`${b.summary.surgeryDate || '1/1/1970'} ${b.summary.startTime || '00:00:00'}`)
        return dateTimeA - dateTimeB
      })
      return combined
    })
    
    setSelectedSessionKeys(prev => {
      const next = new Set(prev)
      sessionsWithNames.forEach(session => next.add(session.sessionKey))
      return Array.from(next)
    })
  }, [])

  const handleSessionNameChange = useCallback((sessionKey, newName) => {
    setSessions(prev => prev.map((session) => 
      session.sessionKey === sessionKey ? { ...session, customName: newName } : session
    ))
  }, [])

  const handleNotesChange = useCallback((sessionKey, newNotes) => {
    setSessions(prev => prev.map((session) => 
      session.sessionKey === sessionKey ? { ...session, notes: newNotes } : session
    ))
  }, [])

  const handleSessionToggle = useCallback((sessionKey) => {
    setSelectedSessionKeys(prev => 
      prev.includes(sessionKey) 
        ? prev.filter(key => key !== sessionKey)
        : [...prev, sessionKey]
    )
  }, [])

  const handleRemoveSession = useCallback((sessionKey) => {
    setSessions(prev => prev.filter(session => session.sessionKey !== sessionKey))
    setSelectedSessionKeys(prev => prev.filter(key => key !== sessionKey))
  }, [])

  const handleDragStart = useCallback((index) => {
    setDraggedIndex(index)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault() // Necesario para permitir el drop
  }, [])

  const handleDrop = useCallback((targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return

    // Reordenar el array de sesiones
    const newSessions = [...sessions]
    const [draggedSession] = newSessions.splice(draggedIndex, 1)
    newSessions.splice(targetIndex, 0, draggedSession)
    setSessions(newSessions)
    setDraggedIndex(null)
  }, [draggedIndex, sessions])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  // Mantener el orden de las sesiones (no el orden de selección)
  const selectedSessionsData = useMemo(() => sessions
    .filter(session => selectedSessionKeys.includes(session.sessionKey)), [sessions, selectedSessionKeys])

  return (
    <div className="app">
      <header className="app-header">
        <h1>📊 Análisis de Baterías - WAD & LS</h1>
        <p>Visualización y comparación de comportamiento de baterías WAD y LS</p>
      </header>

      <main className="app-main">
        <div className="top-section">
          <div className="upload-section">
            <FileUploader onFilesLoaded={handleFilesLoaded} />
          </div>

          <div className="sessions-section">
            {sessions.length > 0 ? (
              <div className="sessions-list">
                <h2>Sesiones Cargadas ({sessions.length})</h2>
                <div className="sessions-grid">
              {sessions.map((session, idx) => {
                return (
                <div 
                  key={session.sessionKey} 
                  className={`session-item ${selectedSessionKeys.includes(session.sessionKey) ? 'selected' : ''} ${draggedIndex === idx ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="drag-handle" title="Arrastrar para reordenar">
                    <span>☰</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedSessionKeys.includes(session.sessionKey)}
                    onChange={() => handleSessionToggle(session.sessionKey)}
                    id={`session-${session.sessionKey}`}
                  />
                  <div className="session-info">
                    <input
                      type="text"
                      className="session-name-input"
                      value={session.customName}
                      onChange={(e) => handleSessionNameChange(session.sessionKey, e.target.value)}
                      placeholder="Nombre de sesión..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="session-metadata">
                      {session.summary.surgeryDate} · {session.summary.duration} min · WAD: {session.summary.wadSerialNumber} · LS: {session.summary.lightSourceSerialNumber}
                    </span>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveSession(session.sessionKey)}
                    title="Eliminar sesión"
                  >
                    ✕
                  </button>
                </div>
              )})}
            </div>
          </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔋</div>
                <h3>No hay sesiones cargadas</h3>
                <p>Arrastra archivos CSV o haz clic en el área de carga para comenzar</p>
              </div>
            )}
          </div>
        </div>

        {selectedSessionsData.length > 0 && (
          <>
            {selectedSessionsData.length === 1 ? (
              <>
                <StatisticsPanel 
                  session={selectedSessionsData[0]} 
                  onNotesChange={(notes) => handleNotesChange(selectedSessionsData[0].sessionKey, notes)}
                />
                <DataTable session={selectedSessionsData[0]} />
              </>
            ) : selectedSessionsData.length === 2 ? (
              <>
                <ComparisonView sessions={selectedSessionsData} />
                <div className="dual-comparison">
                  <div className="comparison-column">
                    <h2 className="comparison-session-title">{selectedSessionsData[0].customName || selectedSessionsData[0].summary.surgeryDate}</h2>
                    <StatisticsPanel 
                      session={selectedSessionsData[0]} 
                      onNotesChange={(notes) => handleNotesChange(selectedSessionsData[0].sessionKey, notes)}
                    />
                  </div>
                  <div className="comparison-column">
                    <h2 className="comparison-session-title">{selectedSessionsData[1].customName || selectedSessionsData[1].summary.surgeryDate}</h2>
                    <StatisticsPanel 
                      session={selectedSessionsData[1]} 
                      onNotesChange={(notes) => handleNotesChange(selectedSessionsData[1].sessionKey, notes)}
                    />
                  </div>
                </div>
                <div className="dual-comparison">
                  <div className="comparison-column">
                    <h3>📋 Tabla de Datos - {selectedSessionsData[0].customName || selectedSessionsData[0].summary.surgeryDate}</h3>
                    <DataTable session={selectedSessionsData[0]} />
                  </div>
                  <div className="comparison-column">
                    <h3>📋 Tabla de Datos - {selectedSessionsData[1].customName || selectedSessionsData[1].summary.surgeryDate}</h3>
                    <DataTable session={selectedSessionsData[1]} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <ComparisonView sessions={selectedSessionsData} />
                {selectedSessionsData.map((session, idx) => (
                  <DataTable key={session.sessionKey} session={session} />
                ))}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
