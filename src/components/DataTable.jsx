import { useState, useMemo } from 'react'
import './DataTable.css'

function DataTable({ session }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const data = session?.data || []
  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data])

  const sessionTitle = useMemo(() => 
    session?.customName || session?.summary?.surgeryDate || 'Sesión'
  , [session])

  if (!session || !data.length) {
    return null
  }

  const handleToggle = () => {
    setIsExpanded(prev => !prev)
  }
  
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
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="table-row-optimized">
                    <td className="row-number">{rowIdx + 1}</td>
                    {columns.map((col) => {
                      const value = row[col]
                      const displayValue = value === null || value === undefined 
                        ? '' 
                        : typeof value === 'object' 
                          ? JSON.stringify(value) 
                          : String(value)
                      return <td key={col}>{displayValue}</td>
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
