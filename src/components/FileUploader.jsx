import { useState, useRef } from 'react'
import { parseCSV, parseSummaryText } from '../utils/csvParser'
import './FileUploader.css'

function FileUploader({ onFilesLoaded }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files)
    processFiles(files)
  }

  const processFiles = async (files) => {
    setIsProcessing(true)
    const csvFiles = files.filter(f => f.name.endsWith('.csv'))
    const txtFiles = files.filter(f => f.name.endsWith('.txt'))

    try {
      const sessions = []

      // Group files by identifier (extract from filename)
      const fileGroups = new Map()

      csvFiles.forEach(file => {
        const match = file.name.match(/battery-debug_([^_]+)_(.+)\.csv/)
        if (match) {
          const id = match[1]
          if (!fileGroups.has(id)) {
            fileGroups.set(id, {})
          }
          fileGroups.get(id).csv = file
        }
      })

      txtFiles.forEach(file => {
        const match = file.name.match(/battery-summary_([^_]+)_(.+)\.txt/)
        if (match) {
          const id = match[1]
          if (!fileGroups.has(id)) {
            fileGroups.set(id, {})
          }
          fileGroups.get(id).txt = file
        }
      })

      // Process each group
      for (const [id, group] of fileGroups.entries()) {
        if (group.csv) {
          const csvData = await parseCSV(group.csv)
          let summary = { surgeryDate: 'Desconocido', duration: 0 }
          
          if (group.txt) {
            const txtContent = await group.txt.text()
            summary = parseSummaryText(txtContent)
          }

          sessions.push({
            id,
            data: csvData,
            summary,
            fileName: group.csv.name,
            txtFile: group.txt // Guardar referencia al archivo TXT
          })
        }
      }

      if (sessions.length > 0) {
        onFilesLoaded(sessions)
      } else {
        alert('No se encontraron archivos CSV válidos')
      }
    } catch (error) {
      console.error('Error procesando archivos:', error)
      alert('Error al procesar los archivos: ' + error.message)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="file-uploader">
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.txt"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        
        {isProcessing ? (
          <>
            <div className="spinner"></div>
            <p>Procesando archivos...</p>
          </>
        ) : (
          <>
            <div className="upload-icon">📁</div>
            <h3>Arrastra archivos aquí</h3>
            <p>o haz clic para seleccionar</p>
            <span className="upload-hint">Soporta múltiples CSVs y TXTs</span>
          </>
        )}
      </div>
    </div>
  )
}

export default FileUploader
