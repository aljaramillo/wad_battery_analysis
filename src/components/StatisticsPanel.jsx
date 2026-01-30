import { Line, Scatter } from 'react-chartjs-2'
import { Chart as ChartJS } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { 
  calculateStatistics, 
  analyzeWADAccuracy, 
  analyzeLSAccuracy,
  processChartData,
  getWADValidData,
  getLSValidData,
  getDeviceTimeline,
  analyzeTemperatureVsUsage,
  analyzeCurrentConsumption,
  analyzeVoltageDegradation,
  analyzePowerConsumption,
  analyzeTemperatureCurrentCorrelation,
  analyzeCapacityComparison,
  analyzeBatteryHealth,
  analyzeTemperatureHeatmap
} from '../utils/dataProcessor'
import ChartTooltip from './ChartTooltip'
import './StatisticsPanel.css'

ChartJS.register(annotationPlugin)

function StatisticsPanel({ session, onNotesChange }) {
  const stats = calculateStatistics(session.data)
  
  // Obtener datos válidos para cada dispositivo PRIMERO
  const wadValidData = getWADValidData(session.data)
  const lsValidData = getLSValidData(session.data)
  
  // DEBUG: Ver cuántos datos tenemos
  console.log('📊 DEBUG - Longitudes de datos:')
  console.log('- Total datos:', session.data.length)
  console.log('- WAD válidos:', wadValidData.length)
  console.log('- LS válidos:', lsValidData.length)
  console.log('- Último WAD Battery %:', session.data[session.data.length - 1]['WAD Battery %'])
  console.log('- Último LS Intensity:', session.data[session.data.length - 1]['Light Source Intensity'])
  
  // DEBUG: Ver últimas 5 filas de WAD
  console.log('📊 DEBUG - Últimas 5 filas de WAD válidas:')
  for (let i = Math.max(0, wadValidData.length - 5); i < wadValidData.length; i++) {
    console.log(`  [${i}] Battery: ${wadValidData[i]['WAD Battery %']}, Duration: ${wadValidData[i]['WAD Duration (min)']}`)
  }
  
  // Análisis de precisión separado por dispositivo - USAR DATOS FILTRADOS
  const wadAccuracyData = analyzeWADAccuracy(wadValidData)
  const lsAccuracyData = analyzeLSAccuracy(lsValidData)
  
  console.log('📊 DEBUG - Accuracy Data:')
  console.log('- wadAccuracyData.length:', wadAccuracyData.length)
  console.log('- lsAccuracyData.length:', lsAccuracyData.length)
  console.log('- Último tiempo WAD accuracy:', wadAccuracyData[wadAccuracyData.length - 1]?.time)
  console.log('- Último tiempo LS accuracy:', lsAccuracyData[lsAccuracyData.length - 1]?.time)
  
  // Datos de gráficas (completos, para uso general)
  const chartData = processChartData(session.data)

  // Sample data (every minute) - SEPARADO POR DISPOSITIVO
  const wadAccuracyTemp = wadAccuracyData.filter((_, idx) => idx % 6 === 0)
  const sampledWadAccuracy = wadAccuracyTemp[wadAccuracyTemp.length - 1] === wadAccuracyData.length - 1
    ? wadAccuracyTemp
    : [...wadAccuracyTemp, wadAccuracyData[wadAccuracyData.length - 1]]
    
  const lsAccuracyTemp = lsAccuracyData.filter((_, idx) => idx % 6 === 0)
  const sampledLsAccuracy = lsAccuracyTemp[lsAccuracyTemp.length - 1] === lsAccuracyData.length - 1
    ? lsAccuracyTemp
    : [...lsAccuracyTemp, lsAccuracyData[lsAccuracyData.length - 1]]

  console.log('📊 DEBUG - Sampled Accuracy:')
  console.log('- sampledWadAccuracy.length:', sampledWadAccuracy.length)
  console.log('- sampledLsAccuracy.length:', sampledLsAccuracy.length)
  console.log('- Último tiempo WAD sampled:', sampledWadAccuracy[sampledWadAccuracy.length - 1]?.time)
  console.log('- Último tiempo LS sampled:', sampledLsAccuracy[sampledLsAccuracy.length - 1]?.time)
  
  // Indices para gráficas que usan datos completos (estos se filtrarán después)
  const sampledIndices = chartData.labels.map((_, idx) => idx).filter((_, idx) => idx % 6 === 0)
  
  // Crear datos procesados solo para el rango válido de LS
  const lsChartData = processChartData(lsValidData)
  const lsSampledTemp = lsChartData.labels.map((_, idx) => idx).filter((_, idx) => idx % 6 === 0)
  const sampledLsIndices = lsSampledTemp[lsSampledTemp.length - 1] === lsChartData.labels.length - 1 
    ? lsSampledTemp 
    : [...lsSampledTemp, lsChartData.labels.length - 1]

  console.log('📊 DEBUG - LS Chart Data:')
  console.log('- lsChartData.labels.length:', lsChartData.labels.length)
  console.log('- sampledLsIndices.length:', sampledLsIndices.length)
  console.log('- Último label LS:', lsChartData.labels[lsChartData.labels.length - 1])
  console.log('- Último sampledLsIndex:', sampledLsIndices[sampledLsIndices.length - 1])
  
  // Crear datos procesados solo para el rango válido de WAD
  const wadChartData = processChartData(wadValidData)
  const wadSampledTemp = wadChartData.labels.map((_, idx) => idx).filter((_, idx) => idx % 6 === 0)
  const sampledWadIndices = wadSampledTemp[wadSampledTemp.length - 1] === wadChartData.labels.length - 1 
    ? wadSampledTemp 
    : [...wadSampledTemp, wadChartData.labels.length - 1]

  console.log('📊 DEBUG - WAD Chart Data:')
  console.log('- wadChartData.labels.length:', wadChartData.labels.length)
  console.log('- sampledWadIndices.length:', sampledWadIndices.length)
  console.log('- Último label WAD:', wadChartData.labels[wadChartData.labels.length - 1])
  console.log('- Último sampledWadIndex:', sampledWadIndices[sampledWadIndices.length - 1])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 10,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: false, // Desactivar autoSkip para control manual
          callback: function(value, index, ticks) {
            const totalTicks = this.chart.data.labels.length
            const maxTicks = 12
            
            // Siempre mostrar el primero
            if (index === 0) {
              return this.getLabelForValue(value)
            }
            
            // Siempre mostrar el último
            if (index === totalTicks - 1) {
              return this.getLabelForValue(value)
            }
            
            // Calcular el intervalo para mostrar aproximadamente maxTicks
            const interval = Math.ceil(totalTicks / maxTicks)
            
            // No mostrar ticks intermedios si están muy cerca del último (dentro de medio intervalo)
            const distanceToLast = totalTicks - 1 - index
            if (distanceToLast < interval * 0.6) {
              return null // Muy cerca del último, no mostrar para evitar solapamiento
            }
            
            // Mostrar si el índice es múltiplo del intervalo
            if (index % interval === 0) {
              return this.getLabelForValue(value)
            }
            
            // No mostrar este tick
            return null
          },
          font: function(context) {
            const totalTicks = context.chart.data.labels.length
            // Aplicar negrita solo al último tick
            if (context.index === totalTicks - 1) {
              return {
                weight: 'bold',
                size: 11
              }
            }
            return {
              weight: 'normal',
              size: 11
            }
          }
        },
        grid: { display: false }
      }
    }
  }

  // WAD Accuracy Chart - USA SOLO DATOS DE WAD
  const wadAccuracyChartData = {
    labels: sampledWadAccuracy.map(d => d.time),
    datasets: [
      {
        label: 'WAD Estimación (min)',
        data: sampledWadAccuracy.map(d => d.estimate),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      },
      {
        label: 'Tiempo Real Restante (min)',
        data: sampledWadAccuracy.map(d => d.actual),
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      },
      {
        label: 'Error de Estimación (min)',
        data: sampledWadAccuracy.map(d => d.error),
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        hidden: true,
        spanGaps: false
      }
    ]
  }

  // Light Source Accuracy Chart - USA SOLO DATOS DE LS
  const lsAccuracyChartData = {
    labels: sampledLsAccuracy.map(d => d.time),
    datasets: [
      {
        label: 'LS Estimación (min)',
        data: sampledLsAccuracy.map(d => d.estimate),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      },
      {
        label: 'Tiempo Real Restante (min)',
        data: sampledLsAccuracy.map(d => d.actual),
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      },
      {
        label: 'Error de Estimación (min)',
        data: sampledLsAccuracy.map(d => d.error),
        borderColor: '#9b59b6',
        backgroundColor: 'rgba(155, 89, 182, 0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        hidden: true,
        spanGaps: false
      }
    ]
  }

  // Comparison Chart
  const comparisonData = {
    labels: sampledIndices.map(i => chartData.labels[i]),
    datasets: [
      {
        label: 'WAD Battery %',
        data: sampledIndices.map(i => chartData.wadBattery[i] >= 0 ? chartData.wadBattery[i] : null),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        spanGaps: false
      },
      {
        label: 'Light Source Battery %',
        data: sampledIndices.map(i => chartData.lightSourceBattery[i] >= 0 ? chartData.lightSourceBattery[i] : null),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        spanGaps: false
      }
    ]
  }

  // Discharge Rate Chart - SEPARADO POR DISPOSITIVO
  const wadDischargeRates = sampledWadIndices.map((idx, i) => {
    if (i === 0) return 0
    const prevIdx = sampledWadIndices[i - 1]
    const currentWad = wadChartData.wadBattery[idx]
    const prevWad = wadChartData.wadBattery[prevIdx]
    return prevWad - currentWad
  })

  const lsDischargeRates = sampledLsIndices.map((idx, i) => {
    if (i === 0) return 0
    const prevIdx = sampledLsIndices[i - 1]
    const currentLs = lsChartData.lightSourceBattery[idx]
    const prevLs = lsChartData.lightSourceBattery[prevIdx]
    return prevLs - currentLs
  })

  // Usar el timeline más largo para la gráfica de comparación
  const maxLength = Math.max(sampledWadIndices.length, sampledLsIndices.length)
  const combinedLabels = []
  const combinedWadRates = []
  const combinedLsRates = []
  
  for (let i = 0; i < maxLength; i++) {
    if (i < sampledWadIndices.length) {
      combinedLabels.push(wadChartData.labels[sampledWadIndices[i]])
      combinedWadRates.push(wadDischargeRates[i])
    } else {
      combinedWadRates.push(null)
    }
    
    if (i < sampledLsIndices.length) {
      if (i >= sampledWadIndices.length) {
        combinedLabels.push(lsChartData.labels[sampledLsIndices[i]])
      }
      combinedLsRates.push(lsDischargeRates[i])
    } else {
      combinedLsRates.push(null)
    }
  }

  const dischargeRateData = {
    labels: combinedLabels,
    datasets: [
      {
        label: 'Tasa Descarga WAD (% / min)',
        data: combinedWadRates,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      },
      {
        label: 'Tasa Descarga LS (% / min)',
        data: combinedLsRates,
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.2)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        spanGaps: false
      }
    ]
  }

  // Intensity Impact Chart - SOLO DATOS VÁLIDOS DE LS
  const intensityImpactData = {
    labels: sampledLsIndices.map(i => lsChartData.labels[i]),
    datasets: [
      {
        label: 'Light Source Battery %',
        data: sampledLsIndices.map(i => lsChartData.lightSourceBattery[i]),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y',
        spanGaps: false
      },
      {
        label: 'Intensidad',
        data: sampledLsIndices.map(i => lsChartData.lightSourceIntensity[i] * 20),
        borderColor: '#feca57',
        backgroundColor: 'rgba(254, 202, 87, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y1',
        spanGaps: false
      }
    ]
  }

  const intensityOptions = {
    ...chartOptions,
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Batería (%)' },
        grid: { color: 'rgba(0, 0, 0, 0.05)' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Intensidad (escala)' },
        grid: { display: false }
      },
      x: chartOptions.scales.x
    }
  }

  // Estimate Evolution Chart
  const estimateEvolutionData = {
    labels: sampledIndices.map(i => chartData.labels[i]),
    datasets: [
      {
        label: 'WAD Estimación (min)',
        data: sampledIndices.map(i => chartData.wadDuration[i]),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      },
      {
        label: 'LS Estimación (min)',
        data: sampledIndices.map(i => chartData.lightSourceDuration[i]),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      }
    ]
  }

  // Quality Impact Chart (WAD)
  // Detectar cambios de calidad
  const qualityChanges = []
  let lastQuality = null
  sampledIndices.forEach((idx, i) => {
    const quality = chartData.wadQuality[idx]
    if (quality !== lastQuality && lastQuality !== null) {
      qualityChanges.push({
        index: i,
        label: chartData.labels[idx],
        from: lastQuality,
        to: quality
      })
    }
    lastQuality = quality
  })

  const qualityImpactData = {
    labels: sampledIndices.map(i => chartData.labels[i]),
    datasets: [
      {
        label: 'WAD Battery %',
        data: sampledIndices.map(i => chartData.wadBattery[i]),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y'
      }
    ]
  }

  const qualityOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          afterBody: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const quality = chartData.wadQuality[sampledIndices[index]]
            const change = qualityChanges.find(c => c.index === index)
            if (change) {
              return [`\nCambio de calidad: ${change.from} → ${change.to}`]
            }
            return [`\nCalidad: ${quality}`]
          }
        }
      },
      annotation: {
        annotations: qualityChanges.reduce((acc, change) => {
          acc[`line${change.index}`] = {
            type: 'line',
            xMin: change.index,
            xMax: change.index,
            borderColor: '#e74c3c',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: `→ ${change.to}`,
              position: 'start',
              backgroundColor: 'rgba(231, 76, 60, 0.9)',
              color: 'white',
              font: {
                size: 10,
                weight: 'bold'
              },
              padding: 4
            }
          }
          return acc
        }, {})
      }
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Batería (%)' },
        grid: { color: 'rgba(0, 0, 0, 0.05)' }
      },
      x: chartOptions.scales.x
    }
  }

  // WAD Battery % vs Duration Estimate - SOLO DATOS VÁLIDOS DE WAD
  const wadBatteryVsEstimateData = {
    labels: sampledWadIndices.map(i => wadChartData.labels[i]),
    datasets: [
      {
        label: 'WAD Battery %',
        data: sampledWadIndices.map(i => wadChartData.wadBattery[i]),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'WAD Estimación (min)',
        data: sampledWadIndices.map(i => wadChartData.wadDuration[i]),
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  }

  const dualAxisOptions = {
    ...chartOptions,
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Batería (%)' },
        grid: { color: 'rgba(0, 0, 0, 0.05)' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: { display: true, text: 'Estimación (min)' },
        grid: { display: false }
      },
      x: chartOptions.scales.x
    }
  }

  // LS Battery % vs Duration Estimate - SOLO DATOS VÁLIDOS DE LS
  const lsBatteryVsEstimateData = {
    labels: sampledLsIndices.map(i => lsChartData.labels[i]),
    datasets: [
      {
        label: 'LS Battery %',
        data: sampledLsIndices.map(i => lsChartData.lightSourceBattery[i]),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'LS Estimación (min)',
        data: sampledLsIndices.map(i => lsChartData.lightSourceDuration[i]),
        borderColor: '#48dbfb',
        backgroundColor: 'rgba(72, 219, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  }

  // Función para guardar cambios en el TXT original
  const saveToOriginalTXT = async () => {
    const sessionName = session.customName || 'Sin nombre'
    const notes = session.notes || ''
    
    let txtContent = `BATTERY DEBUG SUMMARY
=====================
SESSION NAME: ${sessionName}
Surgery Date: ${session.summary.surgeryDate}
Start Time: ${session.summary.startTime || 'N/A'}
End Time: ${session.summary.endTime || 'N/A'}
Duration: ${session.summary.duration} minutes
Total Measurements: ${session.summary.totalMeasurements || session.data.length}

DEVICE INFORMATION
==================
WAD Serial: ${session.summary.wadSerialNumber}
Light Source Serial: ${session.summary.lightSourceSerialNumber}

WAD BATTERY
-----------
Initial: ${session.summary.wadInitial || stats.wad.initial}%
Final: ${session.summary.wadFinal || stats.wad.final}%
Drop: ${session.summary.wadDrop || stats.wad.drop.toFixed(2)}%
Avg Consumption: ${session.summary.wadAvgConsumption || stats.wad.avgConsumption.toFixed(3)}% per minute

LIGHT SOURCE BATTERY
--------------------
Initial: ${session.summary.lightSourceInitial || stats.lightSource.initial}%
Final: ${session.summary.lightSourceFinal || stats.lightSource.final}%
Drop: ${session.summary.lightSourceDrop || stats.lightSource.drop.toFixed(2)}%
Avg Consumption: ${session.summary.lightSourceAvgConsumption || stats.lightSource.avgConsumption.toFixed(3)}% per minute
`

    if (notes) {
      txtContent += `\nDEVELOPER NOTES
===============
${notes}
`
    }

    try {
      // Intentar usar File System Access API para sobrescribir el archivo original
      if ('showSaveFilePicker' in window) {
        const filename = session.txtFile ? session.txtFile.name : (session.fileName ? session.fileName.replace('.csv', '.txt').replace('battery-debug', 'battery-summary') : `battery-summary_${Date.now()}.txt`)
        const opts = {
          suggestedName: filename,
          types: [{
            description: 'Text Files',
            accept: {'text/plain': ['.txt']},
          }],
        }
        
        const handle = await window.showSaveFilePicker(opts)
        const writable = await handle.createWritable()
        await writable.write(txtContent)
        await writable.close()
        
        alert('✅ Archivo guardado correctamente')
      } else {
        // Fallback: descargar como nuevo archivo
        const blob = new Blob([txtContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = session.fileName ? session.fileName.replace('.csv', '.txt').replace('battery-debug', 'battery-summary') : `battery-summary_${Date.now()}.txt`
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        alert('💾 Archivo descargado (no se pudo sobrescribir el original)')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error guardando archivo:', error)
        alert('❌ Error al guardar: ' + error.message)
      }
    }
  }

  // Construir títulos con serial, firmware y fecha
  const wadSerial = session.summary.wadSerialNumber || 'Unknown'
  const lsSerial = session.summary.lightSourceSerialNumber || 'Unknown'
  const wadFirmware = session.summary.wadFirmware || null
  const lsFirmware = session.summary.lightSourceFirmware || null
  const dateInfo = session.summary.surgeryDate || ''

  // ========== PREPARAR DATOS PARA MÉTRICAS TÉCNICAS ADB ==========
  
  // Verificar si hay datos ADB disponibles
  const hasADBData = session.data.some(row => 
    row['WAD ADB Temp (0.1°C)'] !== undefined && 
    row['WAD ADB Temp (0.1°C)'] !== -1 &&
    row['WAD ADB Temp (0.1°C)'] !== null
  )
  
  // 1. Evolución de Temperatura vs Uso
  const tempVsUsageData = hasADBData ? analyzeTemperatureVsUsage(session.data) : []
  const tempVsUsageChartData = {
    labels: tempVsUsageData.map(d => d.time),
    datasets: [
      {
        label: 'Temperatura (°C)',
        data: tempVsUsageData.map(d => d.temperature),
        borderColor: '#ff6384',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        yAxisID: 'y',
        tension: 0.4
      },
      {
        label: 'Batería (%)',
        data: tempVsUsageData.map(d => d.battery),
        borderColor: '#36a2eb',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        yAxisID: 'y1',
        tension: 0.4
      }
    ]
  }

  // 2. Consumo de Corriente en Tiempo Real
  const currentData = hasADBData ? analyzeCurrentConsumption(session.data) : []
  const currentChartData = {
    labels: currentData.map(d => d.time),
    datasets: [
      {
        label: 'Corriente (mA)',
        data: currentData.map(d => d.current),
        borderColor: '#4bc0c0',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.4
      }
    ]
  }

  // 3. Degradación de Voltaje
  const voltageData = hasADBData ? analyzeVoltageDegradation(session.data) : []
  const voltageChartData = {
    labels: voltageData.map((d, idx) => idx), // Usar índice para X
    datasets: [
      {
        type: 'scatter',
        label: 'Voltaje (V)',
        data: voltageData.map(d => ({ x: d.battery, y: d.voltage })),
        backgroundColor: '#9966ff',
        borderColor: '#9966ff',
        pointRadius: 2
      }
    ]
  }

  // 4. Eficiencia Energética (Potencia)
  const powerData = hasADBData ? analyzePowerConsumption(session.data) : []
  const powerChartData = {
    labels: powerData.map(d => d.time),
    datasets: [
      {
        label: 'Potencia (mW)',
        data: powerData.map(d => d.power),
        borderColor: '#ff9f40',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        tension: 0.4
      }
    ]
  }

  // 5. Correlación Temperatura-Corriente
  const tempCurrentData = hasADBData ? analyzeTemperatureCurrentCorrelation(session.data) : []
  const tempCurrentChartData = {
    datasets: [
      {
        type: 'scatter',
        label: 'Puntos de Medición',
        data: tempCurrentData.map(d => ({ x: d.current, y: d.temperature })),
        backgroundColor: tempCurrentData.map(d => {
          // Gradiente de color según progreso (azul -> rojo)
          const progress = d.progress / 100
          const r = Math.floor(54 + progress * (255 - 54))
          const g = Math.floor(162 - progress * 162)
          const b = Math.floor(235 - progress * 235)
          return `rgba(${r}, ${g}, ${b}, 0.6)`
        }),
        pointRadius: 4
      }
    ]
  }

  // 6. Capacidad Real vs Nominal
  const capacityData = hasADBData ? analyzeCapacityComparison(session.data) : []
  const capacityChartData = {
    labels: capacityData.map(d => d.time),
    datasets: [
      {
        label: 'Batería Reportada (%)',
        data: capacityData.map(d => d.reportedBattery),
        borderColor: '#36a2eb',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        tension: 0.4
      },
      {
        label: 'Capacidad ADB (%)',
        data: capacityData.map(d => d.adbCapacity),
        borderColor: '#ff6384',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.4,
        borderDash: [5, 5]
      }
    ]
  }

  // 7. Estado de Salud de la Batería
  const healthData = hasADBData ? analyzeBatteryHealth(session.data) : { changes: [], timeline: [] }
  const healthChartData = {
    labels: healthData.timeline.map(d => d.time),
    datasets: [
      {
        label: 'Estado de Salud',
        data: healthData.timeline.map(d => d.health === 'Good' ? 100 : d.health === 'Unknown' ? 50 : 0),
        borderColor: '#4bc0c0',
        backgroundColor: healthData.timeline.map(d => 
          d.health === 'Good' ? 'rgba(75, 192, 192, 0.1)' : 'rgba(255, 99, 132, 0.1)'
        ),
        stepped: true,
        fill: true
      }
    ]
  }

  // 8. Mapa de Calor: Temperatura durante Duración
  const heatmapData = hasADBData ? analyzeTemperatureHeatmap(session.data) : { bins: [], durationRange: [0, 0], tempRange: [0, 0], rawData: [] }
  // Para el mapa de calor, usaremos un scatter chart con tamaño de punto proporcional
  const heatmapChartData = {
    datasets: [
      {
        type: 'scatter',
        label: 'Densidad de Temperatura',
        data: heatmapData.rawData.map(d => ({ x: d.duration, y: d.temperature })),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        pointRadius: 3
      }
    ]
  }

  // Opciones comunes para gráficas ADB
  const adbDualAxisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        title: { display: true, text: 'Tiempo de Cirugía' },
        ticks: { 
          maxTicksLimit: 10,
          autoSkip: false,
          callback: function(value, index, ticks) {
            const totalTicks = this.chart.data.labels.length
            const maxTicks = 10
            
            if (index === 0) {
              return this.getLabelForValue(value)
            }
            
            if (index === totalTicks - 1) {
              return this.getLabelForValue(value)
            }
            
            const interval = Math.ceil(totalTicks / maxTicks)
            const distanceToLast = totalTicks - 1 - index
            
            if (distanceToLast < interval * 0.6) {
              return null
            }
            
            if (index % interval === 0) {
              return this.getLabelForValue(value)
            }
            
            return null
          },
          font: function(context) {
            const totalTicks = context.chart.data.labels.length
            if (context.index === totalTicks - 1) {
              return { weight: 'bold', size: 11 }
            }
            return { weight: 'normal', size: 11 }
          }
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true },
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    }
  }

  const adbSingleAxisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        title: { display: true, text: 'Tiempo de Cirugía' },
        ticks: { 
          maxTicksLimit: 10,
          autoSkip: false,
          callback: function(value, index, ticks) {
            const totalTicks = this.chart.data.labels.length
            const maxTicks = 10
            
            if (index === 0) {
              return this.getLabelForValue(value)
            }
            
            if (index === totalTicks - 1) {
              return this.getLabelForValue(value)
            }
            
            const interval = Math.ceil(totalTicks / maxTicks)
            const distanceToLast = totalTicks - 1 - index
            
            if (distanceToLast < interval * 0.6) {
              return null
            }
            
            if (index % interval === 0) {
              return this.getLabelForValue(value)
            }
            
            return null
          },
          font: function(context) {
            const totalTicks = context.chart.data.labels.length
            if (context.index === totalTicks - 1) {
              return { weight: 'bold', size: 11 }
            }
            return { weight: 'normal', size: 11 }
          }
        }
      },
      y: {
        title: { display: true }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    }
  }

  const adbScatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true } },
      y: { title: { display: true } }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { mode: 'point' }
    }
  }

  const analysisCharts = [
    {
      id: 'wadAccuracy',
      title: 'Precisión de Estimación WAD vs Duración Real',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Compara la duración estimada que mostraba el dispositivo WAD con el tiempo real que quedaba de cirugía. Una línea cercana indica estimaciones precisas. Haz clic en la leyenda para mostrar/ocultar el error de estimación.',
      data: wadAccuracyChartData,
      options: chartOptions
    },
    {
      id: 'lsAccuracy',
      title: 'Precisión de Estimación Light Source vs Duración Real',
      deviceSerial: lsSerial,
      firmware: lsFirmware,
      tooltip: 'Compara la duración estimada de la fuente de luz con el tiempo real restante. Permite evaluar la fiabilidad del sistema de estimación. Haz clic en la leyenda para mostrar/ocultar el error de estimación.',
      data: lsAccuracyChartData,
      options: chartOptions
    },
    {
      id: 'wadBatteryVsEstimate',
      title: 'WAD: Batería % vs Estimación de Duración',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Relaciona el porcentaje de batería restante del WAD con su estimación de minutos restantes. Permite evaluar la coherencia entre ambas métricas.',
      data: wadBatteryVsEstimateData,
      options: dualAxisOptions
    },
    {
      id: 'lsBatteryVsEstimate',
      title: 'Light Source: Batería % vs Estimación de Duración',
      deviceSerial: lsSerial,
      firmware: lsFirmware,
      tooltip: 'Relaciona el porcentaje de batería del Light Source con su estimación de duración. Útil para identificar inconsistencias en las predicciones.',
      data: lsBatteryVsEstimateData,
      options: dualAxisOptions
    },
    {
      id: 'qualityImpact',
      title: 'Impacto de Calidad de Imagen en Batería WAD',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Analiza cómo la calidad de video configurada (1080p, 2160p, etc.) afecta el consumo de batería del WAD durante la cirugía. Las líneas rojas verticales marcan cambios de calidad.',
      data: qualityImpactData,
      options: qualityOptions
    },
    {
      id: 'intensityImpact',
      title: 'Impacto de Intensidad de Luz en Batería LS',
      deviceSerial: lsSerial,
      firmware: lsFirmware,
      tooltip: 'Relaciona la intensidad de luz configurada con el consumo de batería del Light Source. Ayuda a entender cómo diferentes niveles de intensidad afectan la duración.',
      data: intensityImpactData,
      options: intensityOptions
    },
    {
      id: 'dischargeRate',
      title: 'Verificación de Tasa de Descarga por Minuto',
      deviceSerial: null, // No aplica serial aquí porque muestra ambos dispositivos
      firmware: null,
      tooltip: 'Muestra cuánto porcentaje de batería se consume por minuto en cada momento. Picos indican momentos de alto consumo. Útil para verificar patrones de descarga.',
      data: dischargeRateData,
      options: chartOptions
    }
  ]

  // Array de gráficas de Métricas Técnicas ADB
  const adbMetricsCharts = [
    {
      id: 'tempVsUsage',
      title: 'Evolución de Temperatura vs Uso',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Relaciona la temperatura de la batería WAD (°C) con su nivel de carga (%) durante la cirugía. Permite identificar sobrecalentamiento durante uso intensivo y su correlación con la descarga.',
      data: tempVsUsageChartData,
      options: {
        ...adbDualAxisOptions,
        scales: {
          ...adbDualAxisOptions.scales,
          y: { ...adbDualAxisOptions.scales.y, title: { display: true, text: 'Temperatura (°C)' } },
          y1: { ...adbDualAxisOptions.scales.y1, title: { display: true, text: 'Batería (%)' } }
        }
      }
    },
    {
      id: 'currentConsumption',
      title: 'Consumo de Corriente en Tiempo Real',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Muestra el consumo de corriente (mA) del WAD a lo largo del tiempo. Picos indican momentos de alto consumo energético, posiblemente relacionados con cambios en la calidad de video o intensidad de uso.',
      data: currentChartData,
      options: {
        ...adbSingleAxisOptions,
        scales: {
          ...adbSingleAxisOptions.scales,
          y: { title: { display: true, text: 'Corriente (mA)' } }
        }
      }
    },
    {
      id: 'voltageDegradation',
      title: 'Degradación de Voltaje',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Gráfica de dispersión que muestra cómo el voltaje de la batería (V) cae a medida que se descarga (%). Una caída uniforme indica comportamiento saludable; caídas bruscas pueden indicar problemas o "muerte súbita" de la batería.',
      data: voltageChartData,
      options: {
        ...adbScatterOptions,
        scales: {
          x: { title: { display: true, text: 'Batería (%)' } },
          y: { title: { display: true, text: 'Voltaje (V)' } }
        }
      }
    },
    {
      id: 'powerConsumption',
      title: 'Eficiencia Energética (Potencia Instantánea)',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Calcula la potencia real consumida (mW) = Voltaje × Corriente a lo largo del tiempo. Permite comparar la eficiencia energética entre diferentes momentos de la cirugía o entre sesiones.',
      data: powerChartData,
      options: {
        ...adbSingleAxisOptions,
        scales: {
          ...adbSingleAxisOptions.scales,
          y: { title: { display: true, text: 'Potencia (mW)' } }
        }
      }
    },
    {
      id: 'tempCurrentCorrelation',
      title: 'Correlación Temperatura-Corriente',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Gráfica de dispersión que relaciona el consumo de corriente (mA) con la temperatura de la batería (°C). El color indica el progreso temporal (azul=inicio, rojo=final). Permite verificar si alta corriente causa aumento de temperatura.',
      data: tempCurrentChartData,
      options: {
        ...adbScatterOptions,
        scales: {
          x: { title: { display: true, text: 'Corriente (mA)' } },
          y: { title: { display: true, text: 'Temperatura (°C)' } }
        }
      }
    },
    {
      id: 'capacityComparison',
      title: 'Capacidad Real vs Nominal',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Compara el porcentaje de batería que reporta el sistema WAD con la capacidad real medida por ADB. Desviaciones significativas pueden indicar problemas de calibración o degradación de la batería.',
      data: capacityChartData,
      options: {
        ...adbSingleAxisOptions,
        scales: {
          ...adbSingleAxisOptions.scales,
          y: { title: { display: true, text: 'Capacidad (%)' } }
        }
      }
    },
    {
      id: 'batteryHealth',
      title: 'Estado de Salud de la Batería',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Muestra cambios en el estado de salud reportado por ADB (Good, Fair, Poor) durante la cirugía. Alertas sobre deterioro del estado pueden indicar problemas críticos de hardware.',
      data: healthChartData,
      options: {
        ...adbSingleAxisOptions,
        scales: {
          ...adbSingleAxisOptions.scales,
          y: { 
            title: { display: true, text: 'Estado' },
            ticks: {
              callback: (value) => {
                if (value === 100) return 'Good'
                if (value === 50) return 'Unknown'
                return 'Bad'
              }
            }
          }
        }
      }
    },
    {
      id: 'temperatureHeatmap',
      title: 'Mapa de Calor: Temperatura durante Duración',
      deviceSerial: wadSerial,
      firmware: wadFirmware,
      tooltip: 'Visualiza la distribución de temperatura (°C) a lo largo del tiempo de uso (min). La densidad de puntos indica rangos de temperatura más frecuentes según la duración de la sesión.',
      data: heatmapChartData,
      options: {
        ...adbScatterOptions,
        scales: {
          x: { title: { display: true, text: 'Tiempo Transcurrido (min)' } },
          y: { title: { display: true, text: 'Temperatura (°C)' } }
        }
      }
    }
  ]

  // Nombre de sesión: customName si existe, sino el ID del archivo
  const sessionName = session.customName || session.id
  const sessionTitle = sessionName || session.summary.surgeryDate

  return (
    <div className="statistics-panel">
      <h2>Análisis Estadístico Completo: {sessionTitle}</h2>
      {session.customName && <p className="session-subtitle">{session.id} · {session.summary.surgeryDate} · {session.summary.duration} min</p>}
      {!session.customName && <p className="session-subtitle">{session.summary.surgeryDate} · {session.summary.duration} min</p>}

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th className="centered-header">WAD</th>
              <th className="centered-header">Light Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Batería Inicial</td>
              <td>{stats.wad.initial}%</td>
              <td>{stats.lightSource.initial}%</td>
            </tr>
            <tr>
              <td>Batería Final</td>
              <td>{stats.wad.final}%</td>
              <td>{stats.lightSource.final}%</td>
            </tr>
            <tr>
              <td>Consumo Total</td>
              <td>{stats.wad.drop.toFixed(1)}%</td>
              <td>{stats.lightSource.drop.toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Consumo Promedio</td>
              <td>{stats.wad.avgConsumption.toFixed(2)}% / min</td>
              <td>{stats.lightSource.avgConsumption.toFixed(2)}% / min</td>
            </tr>
            <tr>
              <td>Estimación Máxima</td>
              <td>{stats.wad.maxDurationEstimate} min</td>
              <td>{stats.lightSource.maxDurationEstimate} min</td>
            </tr>
            <tr>
              <td>Estimación Mínima</td>
              <td>{stats.wad.minDurationEstimate} min</td>
              <td>{stats.lightSource.minDurationEstimate} min</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="stats-grid" style={{display: 'none'}}>
        <div className="stat-group">
          <h3>WAD Battery</h3>
          <div className="stat-items">
            <div className="stat-item">
              <span className="stat-label">Batería Inicial:</span>
              <span className="stat-value">{stats.lightSource.initial}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Batería Final:</span>
              <span className="stat-value">{stats.lightSource.final}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Consumo Total:</span>
              <span className="stat-value">{stats.lightSource.drop.toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Consumo Promedio:</span>
              <span className="stat-value">{stats.lightSource.avgConsumption.toFixed(2)}% / min</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Est. Máxima:</span>
              <span className="stat-value">{stats.lightSource.maxDurationEstimate} min</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Est. Mínima:</span>
              <span className="stat-value">{stats.lightSource.minDurationEstimate} min</span>
            </div>
          </div>
        </div>
      </div>

      <h3 className="section-title">📊 Análisis de Baterías</h3>
      <div className="charts-grid">
        {analysisCharts.map(chart => (
          <div key={chart.id} className="chart-card">
            <div className="chart-header">
              <div className="chart-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0 }}>{chart.title}</h3>
                  <ChartTooltip text={chart.tooltip} />
                </div>
                {chart.deviceSerial && (
                  <div style={{ fontSize: '0.75em', fontWeight: 'normal', color: '#666' }}>
                    {sessionName} - {chart.deviceSerial}
                    {chart.firmware && ` [FW: ${chart.firmware}]`}
                    {` (${dateInfo})`}
                  </div>
                )}
                {!chart.deviceSerial && dateInfo && (
                  <div style={{ fontSize: '0.75em', fontWeight: 'normal', color: '#666' }}>
                    {sessionName} ({dateInfo})
                  </div>
                )}
              </div>
            </div>
            <div className="chart-container">
              <Line data={chart.data} options={chart.options} />
            </div>
          </div>
        ))}
        
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-group">
              <h3>Notas del Análisis · {sessionTitle}</h3>
              <ChartTooltip text="Añade observaciones, comentarios o anotaciones técnicas sobre esta sesión. Las notas se incluirán en el archivo TXT exportado." />
            </div>
          </div>
          <div className="notes-container">
            <textarea
              className="notes-textarea"
              value={session.notes || ''}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Añade tus observaciones técnicas sobre esta sesión: comportamiento anómalo, bugs detectados, mejoras sugeridas, etc..."
              rows={8}
            />
            <button className="export-btn" onClick={saveToOriginalTXT}>
              💾 Guardar Cambios en TXT
            </button>
          </div>
        </div>
      </div>

      {hasADBData && (
        <>
          <h3 className="section-title">⚡ Métricas Técnicas ADB del WAD</h3>
          <div className="charts-grid">
        {adbMetricsCharts.map(chart => (
          <div key={chart.id} className="chart-card">
            <div className="chart-header">
              <div className="chart-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0 }}>{chart.title}</h3>
                  <ChartTooltip text={chart.tooltip} />
                </div>
                {chart.deviceSerial && (
                  <div style={{ fontSize: '0.75em', fontWeight: 'normal', color: '#666' }}>
                    {sessionName} - {chart.deviceSerial}
                    {chart.firmware && ` [FW: ${chart.firmware}]`}
                    {` (${dateInfo})`}
                  </div>
                )}
              </div>
            </div>
            <div className="chart-container">
              {chart.id === 'voltageDegradation' || chart.id === 'tempCurrentCorrelation' || chart.id === 'temperatureHeatmap' ? (
                <Scatter data={chart.data} options={chart.options} />
              ) : (
                <Line data={chart.data} options={chart.options} />
              )}
            </div>
          </div>
        ))}
          </div>
        </>
      )}
    </div>
  )
}

export default StatisticsPanel
