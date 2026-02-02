import { useState } from 'react'
import FileUploader from './components/FileUploader'
import ComparisonView from './components/ComparisonView'
import StatisticsPanel from './components/StatisticsPanel'
import DataTable from './components/DataTable'
import './App.css'

function App() {
  const [sessions, setSessions] = useState([])
  const [selectedSessions, setSelectedSessions] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleFilesLoaded = (newSessions) => {
    const sessionsWithNames = newSessions.map(session => ({
      ...session,
      customName: session.summary.customName || session.customName || session.id || '',
      notes: session.summary.notes || session.notes || ''
    }))
    
    // Ordenar por fecha (más antigua primero)
    sessionsWithNames.sort((a, b) => {
      const dateA = new Date(a.summary.surgeryDate || 0)
      const dateB = new Date(b.summary.surgeryDate || 0)
      return dateA - dateB
    })
    
    setSessions(prev => {
      const combined = [...prev, ...sessionsWithNames]
      // Reordenar todo el array por fecha
      combined.sort((a, b) => {
        const dateA = new Date(a.summary.surgeryDate || 0)
        const dateB = new Date(b.summary.surgeryDate || 0)
        return dateA - dateB
      })
      return combined
    })
    
    setSelectedSessions(prev => {
      const newIndices = sessionsWithNames.map((_, idx) => sessions.length + idx)
      return [...prev, ...newIndices]
    })
  }

  const handleSessionNameChange = (index, newName) => {
    setSessions(prev => prev.map((session, idx) => 
      idx === index ? { ...session, customName: newName } : session
    ))
  }

  const handleNotesChange = (index, newNotes) => {
    setSessions(prev => prev.map((session, idx) => 
      idx === index ? { ...session, notes: newNotes } : session
    ))
  }

  const handleSessionToggle = (index) => {
    setSelectedSessions(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const handleRemoveSession = (index) => {
    setSessions(prev => prev.filter((_, i) => i !== index))
    setSelectedSessions(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }

  const handleDragStart = (index) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e) => {
    e.preventDefault() // Necesario para permitir el drop
  }

  const handleDrop = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return

    // Reordenar el array de sesiones
    const newSessions = [...sessions]
    const [draggedSession] = newSessions.splice(draggedIndex, 1)
    newSessions.splice(targetIndex, 0, draggedSession)
    setSessions(newSessions)

    // Actualizar los índices seleccionados
    const newSelectedSessions = selectedSessions.map(idx => {
      if (idx === draggedIndex) return targetIndex
      if (draggedIndex < targetIndex) {
        // Moviendo hacia abajo
        if (idx > draggedIndex && idx <= targetIndex) return idx - 1
      } else {
        // Moviendo hacia arriba
        if (idx >= targetIndex && idx < draggedIndex) return idx + 1
      }
      return idx
    })
    setSelectedSessions(newSelectedSessions)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Mantener el orden de las sesiones (no el orden de selección)
  const selectedSessionsData = sessions
    .map((session, idx) => selectedSessions.includes(idx) ? session : null)
    .filter(Boolean)

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
              {sessions.map((session, idx) => (
                <div 
                  key={idx} 
                  className={`session-item ${selectedSessions.includes(idx) ? 'selected' : ''} ${draggedIndex === idx ? 'dragging' : ''}`}
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
                    checked={selectedSessions.includes(idx)}
                    onChange={() => handleSessionToggle(idx)}
                    id={`session-${idx}`}
                  />
                  <div className="session-info">
                    <input
                      type="text"
                      className="session-name-input"
                      value={session.customName}
                      onChange={(e) => handleSessionNameChange(idx, e.target.value)}
                      placeholder="Nombre de sesión..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="session-metadata">
                      {session.summary.surgeryDate} · {session.summary.duration} min · WAD: {session.summary.wadSerialNumber} · LS: {session.summary.lightSourceSerialNumber}
                    </span>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveSession(idx)}
                    title="Eliminar sesión"
                  >
                    ✕
                  </button>
                </div>
              ))}
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
                  onNotesChange={(notes) => handleNotesChange(selectedSessions[0], notes)}
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
                      onNotesChange={(notes) => handleNotesChange(selectedSessions[0], notes)}
                    />
                  </div>
                  <div className="comparison-column">
                    <h2 className="comparison-session-title">{selectedSessionsData[1].customName || selectedSessionsData[1].summary.surgeryDate}</h2>
                    <StatisticsPanel 
                      session={selectedSessionsData[1]} 
                      onNotesChange={(notes) => handleNotesChange(selectedSessions[1], notes)}
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
                  <DataTable key={idx} session={session} />
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
