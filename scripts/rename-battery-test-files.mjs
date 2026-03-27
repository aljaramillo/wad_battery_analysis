import { readdir, readFile, rename } from 'node:fs/promises'
import path from 'node:path'

const FILE_NAME_PATTERN = /^(battery-(?:debug|summary))_(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.(csv|txt)$/
const WAD_SERIAL_PATTERN = /^WAD Serial:\s*(.+)$/m

const args = process.argv.slice(2)
const applyChanges = args.includes('--apply')
const helpRequested = args.includes('--help') || args.includes('-h')
const targetArgument = args.find(arg => !arg.startsWith('--'))
const targetDirectory = path.resolve(process.cwd(), targetArgument || 'tests_batteryApoloAnalysis')

if (helpRequested) {
  console.log('Uso: node scripts/rename-battery-test-files.mjs [carpeta] [--apply]')
  console.log('')
  console.log('Sin --apply, el script solo muestra el plan de renombrado.')
  console.log('La carpeta por defecto es: tests_batteryApoloAnalysis')
  process.exit(0)
}

const parseFileName = (fileName) => {
  const match = fileName.match(FILE_NAME_PATTERN)
  if (!match) {
    return null
  }

  const [, prefix, sessionId, timestamp, extension] = match

  return {
    prefix,
    sessionId,
    timestamp,
    extension,
    timestampValue: parseTimestampValue(timestamp)
  }
}

const extractWadSerial = (text) => {
  const match = text.match(WAD_SERIAL_PATTERN)
  return match ? match[1].trim() : null
}

const parseTimestampValue = (timestamp) => {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})$/)

  if (!match) {
    return Number.MAX_SAFE_INTEGER
  }

  const [, year, month, day, hour, minute, second] = match
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
}

const padSequence = (sequence) => String(sequence).padStart(3, '0')

const main = async () => {
  const dirEntries = await readdir(targetDirectory, { withFileTypes: true })
  const groupedFiles = new Map()

  for (const entry of dirEntries) {
    if (!entry.isFile()) {
      continue
    }

    const parsed = parseFileName(entry.name)
    if (!parsed) {
      continue
    }

    const key = `${parsed.sessionId}__${parsed.timestamp}`
    const existing = groupedFiles.get(key) || {
      sessionId: parsed.sessionId,
      timestamp: parsed.timestamp,
      timestampValue: Number.isNaN(parsed.timestampValue) ? Number.MAX_SAFE_INTEGER : parsed.timestampValue,
      csvName: null,
      txtName: null,
      wadSerial: null
    }

    if (parsed.extension === 'csv') {
      existing.csvName = entry.name
    }

    if (parsed.extension === 'txt') {
      existing.txtName = entry.name
    }

    groupedFiles.set(key, existing)
  }

  const sessions = Array.from(groupedFiles.values())
  const warnings = []

  for (const session of sessions) {
    if (!session.txtName) {
      warnings.push(`Omitido ${session.sessionId}_${session.timestamp}: falta el archivo TXT para extraer el WAD Serial.`)
      continue
    }

    const txtPath = path.join(targetDirectory, session.txtName)
    const txtContent = await readFile(txtPath, 'utf8')
    session.wadSerial = extractWadSerial(txtContent)

    if (!session.wadSerial) {
      warnings.push(`Omitido ${session.txtName}: no se encontró "WAD Serial:" en el contenido.`)
    }
  }

  const validSessions = sessions.filter(session => session.wadSerial)
  const sessionsByWadSerial = new Map()

  for (const session of validSessions) {
    const list = sessionsByWadSerial.get(session.wadSerial) || []
    list.push(session)
    sessionsByWadSerial.set(session.wadSerial, list)
  }

  const renameOperations = []

  for (const [wadSerial, serialSessions] of sessionsByWadSerial.entries()) {
    serialSessions.sort((left, right) => {
      if (left.timestampValue !== right.timestampValue) {
        return left.timestampValue - right.timestampValue
      }

      return `${left.sessionId}_${left.timestamp}`.localeCompare(`${right.sessionId}_${right.timestamp}`)
    })

    serialSessions.forEach((session, index) => {
      const newSessionId = `${wadSerial}_${padSequence(index + 1)}`

      if (session.txtName) {
        renameOperations.push({
          currentName: session.txtName,
          nextName: `battery-summary_${newSessionId}_${session.timestamp}.txt`
        })
      }

      if (session.csvName) {
        renameOperations.push({
          currentName: session.csvName,
          nextName: `battery-debug_${newSessionId}_${session.timestamp}.csv`
        })
      }
    })
  }

  const effectiveOperations = renameOperations.filter(operation => operation.currentName !== operation.nextName)

  if (warnings.length > 0) {
    console.log('Avisos:')
    warnings.forEach(warning => console.log(`- ${warning}`))
    console.log('')
  }

  if (effectiveOperations.length === 0) {
    console.log('No hay archivos para renombrar.')
    return
  }

  console.log(`${applyChanges ? 'Aplicando' : 'Vista previa de'} ${effectiveOperations.length} renombrados en ${targetDirectory}`)
  effectiveOperations.forEach(operation => {
    console.log(`${operation.currentName} -> ${operation.nextName}`)
  })

  if (!applyChanges) {
    console.log('')
    console.log('Ejecuta de nuevo con --apply para aplicar los cambios.')
    return
  }

  const targetNames = new Set()

  for (const operation of effectiveOperations) {
    if (targetNames.has(operation.nextName)) {
      throw new Error(`Nombre de destino duplicado detectado: ${operation.nextName}`)
    }

    targetNames.add(operation.nextName)
  }

  for (const operation of effectiveOperations) {
    const currentPath = path.join(targetDirectory, operation.currentName)
    const nextPath = path.join(targetDirectory, operation.nextName)
    await rename(currentPath, nextPath)
  }

  console.log('')
  console.log('Renombrado completado.')
}

main().catch(error => {
  console.error('Error al renombrar archivos:', error.message)
  process.exit(1)
})