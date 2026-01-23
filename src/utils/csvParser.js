import Papa from 'papaparse'

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(results.errors)
        } else {
          resolve(results.data)
        }
      },
      error: (error) => {
        reject(error)
      }
    })
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
