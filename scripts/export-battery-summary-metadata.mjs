import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import XLSX from 'xlsx'

const SUMMARY_FILE_PATTERN = /^battery-summary_(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.txt$/

const args = process.argv.slice(2)
const helpRequested = args.includes('--help') || args.includes('-h')
const positionalArgs = args.filter(arg => !arg.startsWith('--'))
const inputDirectory = path.resolve(process.cwd(), positionalArgs[0] || 'tests_batteryApoloAnalysis')
const outputFile = path.resolve(process.cwd(), positionalArgs[1] || path.join(inputDirectory, 'battery-summary-metadata.csv'))
const outputBaseName = outputFile.replace(/\.csv$/i, '')
const excelOutputFile = `${outputBaseName}.xlsx`
const htmlOutputFile = `${outputBaseName}.html`

if (helpRequested) {
  console.log('Uso: node scripts/export-battery-summary-metadata.mjs [carpeta-entrada] [archivo-salida]')
  console.log('')
  console.log('Ejemplo:')
  console.log('  node scripts/export-battery-summary-metadata.mjs tests_batteryApoloAnalysis')
  console.log('  node scripts/export-battery-summary-metadata.mjs tests_batteryApoloAnalysis ./reportes/resumen.csv')
  console.log('')
  console.log('El script genera CSV, XLSX y HTML usando el mismo nombre base de salida.')
  process.exit(0)
}

const parseSummaryFileName = (fileName) => {
  const match = fileName.match(SUMMARY_FILE_PATTERN)

  if (!match) {
    return null
  }

  const [, testName, timestamp] = match
  return { testName, timestamp }
}

const getFieldValue = (text, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escapedLabel}:\\s*(.+)$`, 'm')
  const match = text.match(pattern)
  return match ? match[1].trim() : ''
}

const getWadBatteryInitial = (text) => {
  const sectionMatch = text.match(/WAD BATTERY[\s\S]*?(?:\n\n[A-Z][A-Z ]+\n|$)/)

  if (!sectionMatch) {
    return ''
  }

  const initialMatch = sectionMatch[0].match(/^Initial:\s*([^\n]+)$/m)
  return initialMatch ? initialMatch[1].trim() : ''
}

const normalizeDuration = (value) => {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
  return match ? match[0] : ''
}

const normalizeBatteryPercentage = (value) => {
  const match = String(value ?? '').match(/(-?\d+(?:\.\d+)?)\s*%/)
  return match ? match[1] : ''
}

const csvEscape = (value) => {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const rowsToCsv = (rows) => {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]

  rows.forEach(row => {
    lines.push(headers.map(header => csvEscape(row[header])).join(','))
  })

  return `${lines.join('\n')}\n`
}

const htmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const rowsToHtml = (rows) => {
  if (rows.length === 0) {
    return '<!DOCTYPE html><html><body><p>No hay datos.</p></body></html>'
  }

  const headers = Object.keys(rows[0])
  const headerCells = headers.map(header => `<th>${htmlEscape(header)}</th>`).join('')
  const bodyRows = rows.map(row => {
    const cells = headers.map(header => `<td>${htmlEscape(row[header])}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Battery Summary Metadata</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe6;
      --panel: #fffaf2;
      --line: #d3c3aa;
      --text: #2f2418;
      --accent: #8c5e34;
      --accent-soft: #efe2cf;
    }

    body {
      margin: 0;
      padding: 24px;
      background: linear-gradient(180deg, #f7f2ea 0%, #efe6d8 100%);
      color: var(--text);
      font-family: Georgia, "Times New Roman", serif;
    }

    h1 {
      margin: 0 0 16px;
      font-size: 28px;
      color: var(--accent);
    }

    .table-wrap {
      overflow-x: auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(75, 52, 24, 0.08);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1100px;
    }

    thead {
      background: var(--accent-soft);
    }

    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    tbody tr:nth-child(even) {
      background: rgba(239, 226, 207, 0.35);
    }
  </style>
</head>
<body>
  <h1>Battery Summary Metadata</h1>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </div>
</body>
</html>
`
}

const writeExcelFile = (rows, filePath) => {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'battery-summary')
  XLSX.writeFile(workbook, filePath)
}

const extractMetadata = async (directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const summaryFiles = entries
    .filter(entry => entry.isFile() && SUMMARY_FILE_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))

  const rows = []

  for (const fileName of summaryFiles) {
    const parsed = parseSummaryFileName(fileName)

    if (!parsed) {
      continue
    }

    const filePath = path.join(directoryPath, fileName)
    const content = await readFile(filePath, 'utf8')

    rows.push({
      testName: parsed.testName,
      wadFirmware: getFieldValue(content, 'WAD Firmware'),
      duration: normalizeDuration(getFieldValue(content, 'Duration')),
      surgeryDate: getFieldValue(content, 'Surgery Date'),
      wadBatteryInitial: normalizeBatteryPercentage(getWadBatteryInitial(content)),
      startTime: getFieldValue(content, 'Start Time'),
      endTime: getFieldValue(content, 'End Time'),
      wadQuality: getFieldValue(content, 'WAD Quality'),
      lightSourceSerial: getFieldValue(content, 'Light Source Serial'),
      lightSourceIntensity: getFieldValue(content, 'Light Source Intensity'),
      lightSourceFirmware: getFieldValue(content, 'Light Source Firmware')
    })
  }

  return rows
}

const main = async () => {
  const rows = await extractMetadata(inputDirectory)

  if (rows.length === 0) {
    console.log(`No se encontraron archivos battery-summary_*.txt en ${inputDirectory}`)
    return
  }

  const csvContent = rowsToCsv(rows)
  const htmlContent = rowsToHtml(rows)

  await writeFile(outputFile, csvContent, 'utf8')
  await writeFile(htmlOutputFile, htmlContent, 'utf8')
  writeExcelFile(rows, excelOutputFile)

  console.log(`Archivos generados con ${rows.length} filas:`)
  console.log(outputFile)
  console.log(excelOutputFile)
  console.log(htmlOutputFile)
}

main().catch(error => {
  console.error('Error generando el CSV de metadatos:', error.message)
  process.exit(1)
})