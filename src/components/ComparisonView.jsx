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

function ComparisonView({ sessions }) {
  // Normalize all sessions to the same time scale (percentage of total duration)
  const normalizedData = sessions.map((session, idx) => {
    const chartData = processChartData(session.data)
    const totalPoints = chartData.labels.length
    
    // Sample 100 points from each session for comparison
    const sampleSize = 100
    const step = Math.floor(totalPoints / sampleSize)
    
    const sessionLabel = session.customName || session.summary.surgeryDate
    
    return {
      label: `${sessionLabel} (${session.summary.duration}min)`,
      wadData: chartData.wadBattery.filter((_, i) => i % step === 0).slice(0, sampleSize),
      lsData: chartData.lightSourceBattery.filter((_, i) => i % step === 0).slice(0, sampleSize),
      color: getColorForSession(idx)
    }
  }).reverse() // Invertir para mostrar más antiguo primero

  const labels = Array.from({ length: 100 }, (_, i) => `${i}%`)

  // ========== PREPARAR DATOS DE TIEMPOS MÁXIMOS ==========
  const durationComparisonData = sessions.map((session, idx) => {
    const stats = calculateStatistics(session.data)
    
    return {
      label: session.customName || session.summary.surgeryDate,
      wadDuration: session.summary.duration, // Usar duración de la cirugía
      lsDuration: stats.lightSource.realDuration,
      color: getColorForSession(idx)
    }
  }).reverse() // Invertir para mostrar más antiguo primero

  // Calcular mínimo y máximo para WAD
  const wadDurations = durationComparisonData.map(d => d.wadDuration)
  const minWadDuration = Math.min(...wadDurations)
  const maxWadDuration = Math.max(...wadDurations)

  // Calcular mínimo y máximo para LS
  const lsDurations = durationComparisonData.map(d => d.lsDuration)
  const minLsDuration = Math.min(...lsDurations)
  const maxLsDuration = Math.max(...lsDurations)

  const wadDurationChartData = {
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
  }

  const lsDurationChartData = {
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
  }

  const durationOptions = {
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
  }

  // ========== PREPARAR DATOS ADB COMPARATIVOS ==========
  // Verificar si las sesiones tienen datos ADB
  const sessionsWithADB = sessions.map(session => ({
    hasADB: session.data.some(row => 
      row['WAD ADB Temp (0.1°C)'] !== undefined && 
      row['WAD ADB Temp (0.1°C)'] !== -1 &&
      row['WAD ADB Temp (0.1°C)'] !== null
    ),
    data: session.data,
    label: session.customName || session.summary.surgeryDate,
    firmware: session.summary.wadFirmware || 'N/A'
  })).reverse() // Invertir para mostrar más antiguo primero

  const hasAnyADBData = sessionsWithADB.some(s => s.hasADB)

  // Preparar datos ADB si hay al menos una sesión con datos ADB
  let adbComparisonData = {}
  if (hasAnyADBData) {
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

    adbComparisonData = {
      tempVsBattery: tempDataBySession,
      current: currentDataBySession,
      power: powerDataBySession,
      capacity: capacityDataBySession
    }
  }

  const wadComparisonData = {
    labels,
    datasets: normalizedData.map((session, idx) => ({
      label: session.label,
      data: session.wadData,
      borderColor: session.color,
      backgroundColor: session.color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4
    }))
  }

  const lsComparisonData = {
    labels,
    datasets: normalizedData.map((session, idx) => ({
      label: session.label,
      data: session.lsData,
      borderColor: session.color,
      backgroundColor: session.color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4
    }))
  }

  const options = {
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
          text: `Progreso de Cirugía (%) | Duraciones: ${sessions.slice().reverse().map(s => `${s.customName || s.summary.surgeryDate}: ${s.summary.duration}min`).join(' vs ')}`,
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
  }

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
            <ChartTooltip text="Compara el comportamiento de la batería WAD entre múltiples cirugías normalizadas al 0-100% del tiempo total. Permite identificar patrones consistentes o anomalías." />
          </div>
          <div className="chart-container">
            <Line data={wadComparisonData} options={options} />
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
            {sessions.slice().reverse().map((session, idx) => {
              const batteryStats = session.data ? calculateStatistics(session.data) : null
              
              return (
                <tr key={idx}>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparisonView
