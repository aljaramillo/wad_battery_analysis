import { useMemo } from 'react'
import { Line, Scatter, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { 
  processChartData, 
  getColorForSession,
  getWADValidData,
  getLSValidData,
  analyzeTemperatureVsUsage,
  analyzeCurrentConsumption,
  analyzeVoltageDegradation,
  analyzePowerConsumption,
  analyzeTemperatureCurrentCorrelation,
  analyzeCapacityComparison,
  analyzeBatteryHealth,
  analyzeTemperatureHeatmap,
  calculateStatistics
} from '../utils/dataProcessor'
import ChartTooltip from './ChartTooltip'
import './ComparisonView.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

// Plugin para mostrar valores sobre las barras
const barValuesPlugin = {
  id: 'barValues',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx
    
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex)
      
      // Solo mostrar valores en las barras (no en las líneas)
      if (dataset.type !== 'line' && !meta.hidden) {
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index]
          if (value > 0) {
            ctx.save()
            ctx.fillStyle = '#333'
            ctx.font = 'bold 11px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillText(value.toFixed(1), bar.x, bar.y - 5)
            ctx.restore()
          }
        })
      }
    })
  }
}

const MAIN_SAMPLES = 100

// Plugin para sombrear el último tramo (≤1%) en la comparativa WAD
const shadeTailPlugin = {
  id: 'shadeTail',
  afterDraw(chart) {
    const markers = chart.options._verticalMarkers
    if (!markers || !markers.length) return
    const { ctx, chartArea, scales } = chart
    if (!scales.x || !chartArea) return
    markers.forEach(({ index, color, label }) => {
      if (index === null || index === undefined) return
      const xPixel = scales.x.getPixelForValue(index)
      if (xPixel < chartArea.left || xPixel > chartArea.right) return
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.moveTo(xPixel, chartArea.top)
      ctx.lineTo(xPixel, chartArea.bottom)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, xPixel, chartArea.top + 4)
      ctx.restore()
    })
  }
}

function ComparisonView({ sessions }) {
  // Muestrea N puntos de un array incluyendo siempre el primero y el último,
  // con índices proporcionales. Garantiza que el final del array siempre esté
  // representado independientemente del tamaño del array.
  const sampleEvenly = (arr, n) => {
    if (arr.length === 0) return []
    if (arr.length <= n) return arr.map(v => v < 0 ? null : v)
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round(i * (arr.length - 1) / (n - 1))
      const v = arr[idx]
      return v < 0 ? null : v
    })
  }

  const normalizedData = useMemo(() => sessions.map((session, idx) => {
    // Para WAD: 0-100% = duración completa activa del WAD
    // Usando sampleEvenly: el último punto SIEMPRE es el último registro,
    // así la cola plana al 1% queda bien representada al final de la curva.
    const wadValidData = getWADValidData(session.data)
    const wadAllValues = wadValidData.map(row => row['WAD Battery %'])
    const wadSampled = sampleEvenly(wadAllValues, MAIN_SAMPLES)

    const lastAboveOneRaw = wadAllValues.findLastIndex(v => v > 1)
    const wadTailDurationMin = lastAboveOneRaw >= 0 && lastAboveOneRaw < wadAllValues.length - 1
      ? Math.round((wadAllValues.length - (lastAboveOneRaw + 1)) / 6)
      : 0
    const wadTotalMin = Math.round(wadValidData.length / 6)

    const lsValidData = getLSValidData(session.data)
    const lsAllValues = lsValidData.map(row => row['Light Source %'])
    const lsSampled = sampleEvenly(lsAllValues, MAIN_SAMPLES)

    const sessionLabel = session.customName || session.summary.surgeryDate

    return {
      label: sessionLabel + ' (' + wadTotalMin + 'min' + (wadTailDurationMin > 0 ? ', cola \u22641%: ' + wadTailDurationMin + 'min' : '') + ')',
      wadData: wadSampled,
      wadTailDurationMin,
      lsData: lsSampled,
      color: getColorForSession(idx)
    }
  }), [sessions])

  const labels = useMemo(() => Array.from({ length: MAIN_SAMPLES }, (_, i) => `${i}%`), [])

  // ========== PREPARAR DATOS DE TIEMPOS MÁXIMOS ==========
  const { 
    durationComparisonData, 
    minWadDuration, 
    maxWadDuration, 
    minLsDuration, 
    maxLsDuration 
  } = useMemo(() => {
    const comparison = sessions.map((session, idx) => {
      const stats = calculateStatistics(session.data)
      
      return {
        label: session.customName || session.summary.surgeryDate,
        wadDuration: session.summary.duration, // Usar duración de la cirugía
        lsDuration: stats.lightSource.realDuration,
        color: getColorForSession(idx)
      }
    })

    const wadDurs = comparison.map(d => d.wadDuration)
    const lsDurs = comparison.map(d => d.lsDuration)

    return {
      durationComparisonData: comparison,
      minWadDuration: Math.min(...wadDurs),
      maxWadDuration: Math.max(...wadDurs),
      minLsDuration: Math.min(...lsDurs),
      maxLsDuration: Math.max(...lsDurs)
    }
  }, [sessions])

  const wadDurationChartData = useMemo(() => ({
    labels: durationComparisonData.map(d => d.label),
    datasets: [
      {
        label: 'Duración WAD (min)',
        data: durationComparisonData.map(d => d.wadDuration),
        backgroundColor: durationComparisonData.map(d => d.color + 'CC'),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2
      },
      {
        type: 'line',
        label: 'Mínimo',
        data: Array(durationComparisonData.length).fill(minWadDuration),
        borderColor: 'rgba(231, 76, 60, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        hidden: true
      },
      {
        type: 'line',
        label: 'Máximo',
        data: Array(durationComparisonData.length).fill(maxWadDuration),
        borderColor: 'rgba(46, 204, 113, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        hidden: true
      },
      {
        type: 'line',
        label: `Diferencia Máx-Mín: ${(maxWadDuration - minWadDuration).toFixed(1)} min`,
        data: [],
        borderWidth: 0,
        pointRadius: 0
      }
    ]
  }), [durationComparisonData, minWadDuration, maxWadDuration])

  const lsDurationChartData = useMemo(() => ({
    labels: durationComparisonData.map(d => d.label),
    datasets: [
      {
        label: 'Duración LS (min)',
        data: durationComparisonData.map(d => d.lsDuration),
        backgroundColor: durationComparisonData.map(d => d.color + 'CC'),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2
      },
      {
        type: 'line',
        label: 'Mínimo',
        data: Array(durationComparisonData.length).fill(minLsDuration),
        borderColor: 'rgba(231, 76, 60, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        hidden: true
      },
      {
        type: 'line',
        label: 'Máximo',
        data: Array(durationComparisonData.length).fill(maxLsDuration),
        borderColor: 'rgba(46, 204, 113, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        hidden: true
      },
      {
        type: 'line',
        label: `Diferencia Máx-Mín: ${(maxLsDuration - minLsDuration).toFixed(1)} min`,
        data: [],
        borderWidth: 0,
        pointRadius: 0
      }
    ]
  }), [durationComparisonData, minLsDuration, maxLsDuration])

  const durationOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    hover: {
      mode: null  // Desactivar completamente el hover
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          },
          generateLabels: function(chart) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels
            const labels = original.call(this, chart)
            
            // Forzar círculos para todos los datasets
            labels.forEach(label => {
              label.pointStyle = 'circle'
            })
            
            return labels
          }
        }
      },
      tooltip: {
        enabled: false  // Desactivar tooltip ya que el valor está visible en las barras
      }
    },
    scales: {
      y: {
        min: function(context) {
          const datasetData = context.chart.data.datasets[0].data
          const min = Math.min(...datasetData)
          return Math.max(0, min - 30)
        },
        max: function(context) {
          const datasetData = context.chart.data.datasets[0].data
          const max = Math.max(...datasetData)
          return max + 30
        },
        title: {
          display: true,
          text: 'Duración (minutos)',
          font: {
            size: 13,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Sesión',
          font: {
            size: 13,
            weight: '500'
          }
        },
        grid: {
          display: false
        }
      }
    }
  }), [])

  // ========== PREPARAR DATOS ADB COMPARATIVOS ==========
  // Verificar si las sesiones tienen datos ADB
  const sessionsWithADB = useMemo(() => sessions.map(session => ({
    hasADB: session.data.some(row => 
      row['WAD ADB Temp (0.1°C)'] !== undefined && 
      row['WAD ADB Temp (0.1°C)'] !== -1 &&
      row['WAD ADB Temp (0.1°C)'] !== null
    ),
    data: session.data,
    label: session.customName || session.summary.surgeryDate,
    firmware: session.summary.wadFirmware || 'N/A'
  })), [sessions])

  const hasAnyADBData = useMemo(() => sessionsWithADB.some(s => s.hasADB), [sessionsWithADB])

  // Preparar datos ADB si hay al menos una sesión con datos ADB
  const adbComparisonData = useMemo(() => {
    if (!hasAnyADBData) return {}

    // 1. Temperatura vs Batería
    const tempDataBySession = sessionsWithADB.map((s, idx) => {
      if (!s.hasADB) return null
      const data = analyzeTemperatureVsUsage(s.data)
      const sampleSize = 100
      const step = Math.max(1, Math.floor(data.length / sampleSize))
      return {
        temperature: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.temperature),
        battery: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.battery),
        color: getColorForSession(idx),
        label: s.label
      }
    }).filter(Boolean)

    // 2. Consumo de Corriente
    const currentDataBySession = sessionsWithADB.map((s, idx) => {
      if (!s.hasADB) return null
      const data = analyzeCurrentConsumption(s.data)
      const sampleSize = 100
      const step = Math.max(1, Math.floor(data.length / sampleSize))
      return {
        current: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.current),
        color: getColorForSession(idx),
        label: s.label
      }
    }).filter(Boolean)

    // 3. Consumo de Potencia
    const powerDataBySession = sessionsWithADB.map((s, idx) => {
      if (!s.hasADB) return null
      const data = analyzePowerConsumption(s.data)
      const sampleSize = 100
      const step = Math.max(1, Math.floor(data.length / sampleSize))
      return {
        power: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.power),
        color: getColorForSession(idx),
        label: s.label
      }
    }).filter(Boolean)

    // 4. Capacidad Reportada vs Real
    const capacityDataBySession = sessionsWithADB.map((s, idx) => {
      if (!s.hasADB) return null
      const data = analyzeCapacityComparison(s.data)
      const sampleSize = 100
      const step = Math.max(1, Math.floor(data.length / sampleSize))
      return {
        reported: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.reportedBattery),
        adb: data.filter((_, i) => i % step === 0).slice(0, sampleSize).map(d => d.adbCapacity),
        color: getColorForSession(idx),
        label: s.label
      }
    }).filter(Boolean)

    return {
      tempVsBattery: tempDataBySession,
      current: currentDataBySession,
      power: powerDataBySession,
      capacity: capacityDataBySession
    }
  }, [hasAnyADBData, sessionsWithADB])

  const wadComparisonData = useMemo(() => ({
    labels,
    datasets: normalizedData.map((session) => ({
      label: session.label,
      data: session.wadData,
      borderColor: session.color,
      backgroundColor: session.color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0  // sin suavizado: la cola plana al 1% se ve como línea horizontal
    }))
  }), [labels, normalizedData])

  const lsComparisonData = useMemo(() => ({
    labels,
    datasets: normalizedData.map((session) => ({
      label: session.label,
      data: session.lsData,
      borderColor: session.color,
      backgroundColor: session.color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4
    }))
  }), [labels, normalizedData])

  const options = useMemo(() => ({
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
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y}%`
          }
        }
      }
    },
    scales: {
      y: {
        min: -1,
        max: 100,
        title: {
          display: true,
          text: 'Nivel de Batería (%)',
          font: {
            size: 13,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        title: {
          display: true,
          text: `Progreso de Cirugía (%) | Duraciones: ${sessions.map(s => `${s.customName || s.summary.surgeryDate}: ${s.summary.duration}min`).join(' vs ')}`,
          font: {
            size: 13,
            weight: '500'
          }
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10,
          callback: function(value, index, ticks) {
            // Siempre mostrar 0% y 100%
            if (index === 0 || index === ticks.length - 1) {
              return this.getLabelForValue(value)
            }
            return this.getLabelForValue(value)
          }
        },
        grid: {
          display: false
        },
        afterFit: function(scale) {
          // Asegurar que se muestra el 100%
          if (scale.ticks.length > 0) {
            scale.ticks[scale.ticks.length - 1].major = true
          }
        }
      }
    }
  }), [sessions])

  const wadOptions = useMemo(() => ({
    ...options,
    scales: {
      ...options.scales,
      y: {
        ...options.scales.y,
        min: 0,
        max: 100
      },
      x: {
        ...options.scales.x,
        title: {
          display: true,
          text: `Progreso WAD (%) — 0% inicio, 100% apagado. La leyenda indica los minutos en ≤1% antes del apagado.`,
          font: { size: 11, weight: '500' }
        }
      }
    }
  }), [options])

  return (
    <div className="comparison-view">
      <h2>Vista de Comparación ({sessions.length} sesiones)</h2>
      
      {/* Gráficas de Duración de Dispositivos */}
      <div className="comparison-charts">
        <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
          <div className="chart-header">
            <h3>Duración WAD</h3>
            <ChartTooltip text="Compara la duración de funcionamiento del dispositivo WAD en cada cirugía. Las líneas discontinuas muestran el valor mínimo (rojo) y máximo (verde) entre todas las sesiones." />
          </div>
          <div className="chart-container">
            <Bar data={wadDurationChartData} options={durationOptions} plugins={[barValuesPlugin]} />
          </div>
        </div>

        <div className="comparison-chart" style={{ backgroundColor: '#fffde7' }}>
          <div className="chart-header">
            <h3>Duración Light Source</h3>
            <ChartTooltip text="Compara la duración de funcionamiento del dispositivo Light Source en cada cirugía. Las líneas discontinuas muestran el valor mínimo (rojo) y máximo (verde) entre todas las sesiones." />
          </div>
          <div className="chart-container">
            <Bar data={lsDurationChartData} options={durationOptions} plugins={[barValuesPlugin]} />
          </div>
        </div>
      </div>

      <div className="comparison-charts">
        <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
          <div className="chart-header">
            <h3>Comparación WAD Battery</h3>
            <ChartTooltip text="El eje X va de 0% a 100% donde 100% = momento en que la batería WAD llega a ≤1% (batería útil agotada). La leyenda muestra cuántos minutos siguió funcionando en ≤1% antes de apagarse definitivamente." />
          </div>
          <div className="chart-container">
            <Line data={wadComparisonData} options={wadOptions} plugins={[shadeTailPlugin]} />
          </div>
        </div>

        <div className="comparison-chart" style={{ backgroundColor: '#fffde7' }}>
          <div className="chart-header">
            <h3>Comparación Light Source Battery</h3>
            <ChartTooltip text="Compara el consumo del Light Source entre sesiones. Útil para evaluar diferencias según configuración de intensidad o duración de cirugía." />
          </div>
          <div className="chart-container">
            <Line data={lsComparisonData} options={options} />
          </div>
        </div>
      </div>

      {hasAnyADBData && (
        <div className="adb-comparison-section">
          <h2>⚡ Comparación de Métricas Técnicas ADB</h2>
          <div className="comparison-charts">
            {/* Temperatura vs Batería */}
            {adbComparisonData.tempVsBattery && adbComparisonData.tempVsBattery.length > 0 && (
              <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
                <div className="chart-header">
                  <h3>Temperatura vs Batería</h3>
                  <ChartTooltip text="Compara la evolución de temperatura del WAD entre sesiones durante el consumo de batería." />
                </div>
                <div className="chart-container">
                  <Line
                    data={{
                      labels,
                      datasets: [
                        ...adbComparisonData.tempVsBattery.map(s => ({
                          label: `${s.label} - Temp (°C)`,
                          data: s.temperature,
                          borderColor: s.color,
                          backgroundColor: s.color,
                          borderWidth: 2,
                          pointRadius: 0,
                          pointHoverRadius: 4,
                          tension: 0.4,
                          yAxisID: 'y'
                        })),
                        ...adbComparisonData.tempVsBattery.map(s => ({
                          label: `${s.label} - Batería (%)`,
                          data: s.battery,
                          borderColor: s.color,
                          backgroundColor: s.color,
                          borderWidth: 2,
                          borderDash: [5, 5],
                          pointRadius: 0,
                          pointHoverRadius: 4,
                          tension: 0.4,
                          yAxisID: 'y1'
                        }))
                      ]
                    }}
                    options={{
                      ...options,
                      scales: {
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          title: { display: true, text: 'Temperatura (°C)' }
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          title: { display: true, text: 'Batería (%)' },
                          grid: { drawOnChartArea: false }
                        },
                        x: options.scales.x
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Consumo de Corriente */}
            {adbComparisonData.current && adbComparisonData.current.length > 0 && (
              <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
                <div className="chart-header">
                  <h3>Consumo de Corriente</h3>
                  <ChartTooltip text="Compara el consumo de corriente en mA entre sesiones durante la cirugía." />
                </div>
                <div className="chart-container">
                  <Line
                    data={{
                      labels,
                      datasets: adbComparisonData.current.map(s => ({
                        label: `${s.label} - Corriente (mA)`,
                        data: s.current,
                        borderColor: s.color,
                        backgroundColor: s.color,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.4
                      }))
                    }}
                    options={{
                      ...options,
                      scales: {
                        y: {
                          beginAtZero: false,
                          title: { display: true, text: 'Corriente (mA)' }
                        },
                        x: options.scales.x
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Consumo de Potencia */}
            {adbComparisonData.power && adbComparisonData.power.length > 0 && (
              <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
                <div className="chart-header">
                  <h3>Consumo de Potencia</h3>
                  <ChartTooltip text="Compara el consumo de potencia calculado (V × I) en mW entre sesiones." />
                </div>
                <div className="chart-container">
                  <Line
                    data={{
                      labels,
                      datasets: adbComparisonData.power.map(s => ({
                        label: `${s.label} - Potencia (mW)`,
                        data: s.power,
                        borderColor: s.color,
                        backgroundColor: s.color,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.4
                      }))
                    }}
                    options={{
                      ...options,
                      scales: {
                        y: {
                          beginAtZero: false,
                          title: { display: true, text: 'Potencia (mW)' }
                        },
                        x: options.scales.x
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Capacidad Reportada vs ADB */}
            {adbComparisonData.capacity && adbComparisonData.capacity.length > 0 && (
              <div className="comparison-chart" style={{ backgroundColor: '#f3f9fd' }}>
                <div className="chart-header">
                  <h3>Capacidad: Sistema vs ADB</h3>
                  <ChartTooltip text="Compara la capacidad reportada por el sistema versus la leída por ADB. Las diferencias indican problemas de calibración." />
                </div>
                <div className="chart-container">
                  <Line
                    data={{
                      labels,
                      datasets: [
                        ...adbComparisonData.capacity.map(s => ({
                          label: `${s.label} - Sistema (%)`,
                          data: s.reported,
                          borderColor: s.color,
                          backgroundColor: s.color,
                          borderWidth: 2,
                          pointRadius: 0,
                          pointHoverRadius: 4,
                          tension: 0.4
                        })),
                        ...adbComparisonData.capacity.map(s => ({
                          label: `${s.label} - ADB (%)`,
                          data: s.adb,
                          borderColor: s.color,
                          backgroundColor: s.color,
                          borderWidth: 2,
                          borderDash: [5, 5],
                          pointRadius: 0,
                          pointHoverRadius: 4,
                          tension: 0.4
                        }))
                      ]
                    }}
                    options={{
                      ...options,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          title: { display: true, text: 'Capacidad (%)' }
                        },
                        x: options.scales.x
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="comparison-table">
        <h3>Tabla Comparativa</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>Sesión</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>Fecha</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>Hora de inicio</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>WAD Inicial</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>WAD Final</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>WAD Consumo</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>WAD Duración</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>LS Inicial</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>LS Final</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>LS Consumo</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>LS Duración</th>
            </tr>
          </thead>
          <tbody>
            {useMemo(() => sessions.slice().reverse().map((session, idx) => {
              const batteryStats = session.data ? calculateStatistics(session.data) : null
              
              return (
                <tr key={session.summary.surgeryDate + idx}>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.customName || `Sesión ${sessions.length - idx}`}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.surgeryDate}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.startTime || 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>{session.summary.wadInitial}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>{session.summary.wadFinal}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>{session.summary.wadDrop?.toFixed(1)}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#e3f2fd' }}>{session.summary.duration > 0 ? `${session.summary.duration} min` : 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>{session.summary.lightSourceInitial}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>{session.summary.lightSourceFinal}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>{session.summary.lightSourceDrop?.toFixed(1)}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#fff9c4' }}>{batteryStats?.lightSource?.realDuration > 0 ? `${batteryStats.lightSource.realDuration.toFixed(1)} min` : 'N/A'}</td>
                </tr>
              )
            }), [sessions])}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparisonView
