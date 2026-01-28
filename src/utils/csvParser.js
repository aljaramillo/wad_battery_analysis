import Papa from 'papaparse'

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false, // Desactivar para manejar "--" manualmente
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(results.errors)
        } else {
          // Procesar datos: convertir tipos y manejar "--"
          const processedData = processADBData(results.data)
          resolve(processedData)
        }
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * Procesa los datos ADB del WAD:
 * - Convierte tipos numéricos
 * - Reemplaza "--" con el valor anterior (carry-forward)
 * - Maneja valores especiales (-1 para apagado)
 */
const processADBData = (rawData) => {
  // Campos que deben ser numéricos
  const numericFields = [
    'WAD Battery %',
    'WAD Duration (min)',
    'Light Source %',
    'Light Source Duration (min)',
    'Light Source Intensity'
  ]
  
  // Campos ADB que pueden ser "--" y necesitan carry-forward
  const adbNumericFields = [
    'WAD ADB Capacity',
    'WAD ADB Current (uA)',
    'WAD ADB Voltage (uV)',
    'WAD ADB Temp (0.1°C)'
  ]
  
  // Campos de texto ADB
  const adbTextFields = ['WAD ADB Health', 'WAD ADB Status']
  
  // Valores anteriores para carry-forward
  const lastValidValues = {}
  
  return rawData.map((row, index) => {
    const processed = { ...row }
    
    // Convertir campos numéricos estándar
    numericFields.forEach(field => {
      if (row[field] === null || row[field] === undefined || row[field] === '') {
        processed[field] = -1
      } else {
        const value = parseFloat(row[field])
        processed[field] = isNaN(value) ? -1 : value
      }
    })
    
    // Procesar campos ADB numéricos con carry-forward
    adbNumericFields.forEach(field => {
      const rawValue = row[field]
      
      if (rawValue === '--' || rawValue === '' || rawValue === null || rawValue === undefined) {
        // Si es "--" o vacío, usar el valor anterior
        if (lastValidValues[field] !== undefined) {
          processed[field] = lastValidValues[field]
        } else {
          // Si no hay valor anterior, usar -1
          processed[field] = -1
        }
      } else {
        // Intentar convertir a número
        const value = parseFloat(rawValue)
        if (!isNaN(value)) {
          processed[field] = value
          lastValidValues[field] = value // Guardar como último válido
        } else {
          // Si no es número, usar último valor o -1
          processed[field] = lastValidValues[field] !== undefined ? lastValidValues[field] : -1
        }
      }
    })
    
    // Procesar campos ADB de texto con carry-forward
    adbTextFields.forEach(field => {
      const rawValue = row[field]
      
      if (rawValue === '--' || rawValue === '' || rawValue === null || rawValue === undefined) {
        // Si es "--", usar el valor anterior
        if (lastValidValues[field] !== undefined) {
          processed[field] = lastValidValues[field]
        } else {
          processed[field] = 'Unknown'
        }
      } else {
        processed[field] = rawValue
        lastValidValues[field] = rawValue
      }
    })
    
    return processed
  })
}

export const parseSummaryText = (text) => {
  const lines = text.split('\n')
  const summary = {}

  lines.forEach(line => {
    if (line.includes('Surgery Date:')) {
      summary.surgeryDate = line.split(':')[1].trim()
    } else if (line.includes('Duration:')) {
      summary.duration = parseInt(line.split(':')[1])
    } else if (line.includes('Total Measurements:')) {
      summary.totalMeasurements = parseInt(line.split(':')[1])
    } else if (line.includes('WAD Serial:')) {
      summary.wadSerialNumber = line.split(':')[1].trim()
    } else if (line.includes('Light Source Serial:')) {
      summary.lightSourceSerialNumber = line.split(':')[1].trim()
    } else if (line.includes('WAD Firmware:')) {
      summary.wadFirmware = line.split(':')[1].trim()
    } else if (line.includes('Light Source Firmware:')) {
      summary.lightSourceFirmware = line.split(':')[1].trim()
    } else if (line.includes('Start Time:')) {
      summary.startTime = line.split('Time:')[1].trim()
    } else if (line.includes('End Time:')) {
      summary.endTime = line.split('Time:')[1].trim()
    } else if (line.includes('SESSION NAME:')) {
      summary.customName = line.split('SESSION NAME:')[1].trim()
    }
  })

  // Extraer notas si existen
  const notesIndex = text.indexOf('DEVELOPER NOTES')
  if (notesIndex !== -1) {
    const notesSection = text.substring(notesIndex)
    const notesLines = notesSection.split('\n').slice(2) // Skip header and separator
    summary.notes = notesLines.join('\n').trim()
  }

  // WAD Battery info
  const wadSection = text.substring(text.indexOf('WAD BATTERY'), text.indexOf('LIGHT SOURCE BATTERY'))
  const wadInitialMatch = wadSection.match(/Initial: (\d+)%/)
  const wadFinalMatch = wadSection.match(/Final: (-?\d+)%/)
  const wadDropMatch = wadSection.match(/Drop: ([\d.]+)%/)
  const wadAvgMatch = wadSection.match(/Avg Consumption: ([\d.]+)%/)

  if (wadInitialMatch) summary.wadInitial = parseInt(wadInitialMatch[1])
  if (wadFinalMatch) summary.wadFinal = parseInt(wadFinalMatch[1])
  if (wadDropMatch) summary.wadDrop = parseFloat(wadDropMatch[1])
  if (wadAvgMatch) summary.wadAvgConsumption = parseFloat(wadAvgMatch[1])

  // Light Source Battery info
  const lsSection = text.substring(text.indexOf('LIGHT SOURCE BATTERY'))
  const lsInitialMatch = lsSection.match(/Initial: (\d+)%/)
  const lsFinalMatch = lsSection.match(/Final: (-?\d+)%/)
  const lsDropMatch = lsSection.match(/Drop: ([\d.]+)%/)
  const lsAvgMatch = lsSection.match(/Avg Consumption: ([\d.]+)%/)

  if (lsInitialMatch) summary.lightSourceInitial = parseInt(lsInitialMatch[1])
  if (lsFinalMatch) summary.lightSourceFinal = parseInt(lsFinalMatch[1])
  if (lsDropMatch) summary.lightSourceDrop = parseFloat(lsDropMatch[1])
  if (lsAvgMatch) summary.lightSourceAvgConsumption = parseFloat(lsAvgMatch[1])

  return summary
}
