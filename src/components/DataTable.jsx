import { useState } from 'react'
import './DataTable.css'

function DataTable({ session }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!session || !session.data || session.data.length === 0) {
    return null
  }

  const data = session.data
  const columns = Object.keys(data[0])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const sessionTitle = session.customName || session.summary?.surgeryDate || 'Sesión'
  
  return (
    <div className="data-table-container">
      <div className="data-table-header" onClick={handleToggle}>
        <div className="data-table-title">
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3>Datos del CSV - {sessionTitle}</h3>
          <span className="data-count">({data.length} registros)</span>
        </div>
        <button className="toggle-btn" onClick={handleToggle}>
          {isExpanded ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {isExpanded && (
        <div className="data-table-content">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="row-number">#</th>
                  {columns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="row-number">{rowIdx + 1}</td>
                    {columns.map((col, colIdx) => {
                      const value = row[col]
                      // Convertir cualquier valor a string para evitar errores con objetos
                      const displayValue = value === null || value === undefined 
                        ? '' 
                        : typeof value === 'object' 
                          ? JSON.stringify(value) 
                          : String(value)
                      return <td key={colIdx}>{displayValue}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable
