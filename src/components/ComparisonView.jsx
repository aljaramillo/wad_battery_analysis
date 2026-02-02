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
      wadEstimatedDuration: stats.wad.timeToOneMinute,
      lsEstimatedDuration: stats.lightSource.timeToOneMinute,
      realDuration: session.summary.duration,
      color: getColorForSession(idx)
    }
  }).reverse() // Invertir para mostrar más antiguo primero

  const wadDurationChartData = {
    labels: durationComparisonData.map(d => d.label),
    datasets: [
      {
        label: 'Duración Estimada WAD (min)',
        data: durationComparisonData.map(d => d.wadEstimatedDuration),
        backgroundColor: durationComparisonData.map(d => d.color + '80'),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2,
        order: 2
      },
      {
        label: 'Duración Real (min)',
        data: durationComparisonData.map(d => d.realDuration),
        backgroundColor: durationComparisonData.map(d => {
          // Convertir el color a más oscuro
          const hex = d.color.replace('#', '')
          const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 60)
          const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 60)
          const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 60)
          return `rgb(${r}, ${g}, ${b})`
        }),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2,
        order: 1
      }
    ]
  }

  const lsDurationChartData = {
    labels: durationComparisonData.map(d => d.label),
    datasets: [
      {
        label: 'Duración Estimada LS (min)',
        data: durationComparisonData.map(d => d.lsEstimatedDuration),
        backgroundColor: durationComparisonData.map(d => d.color + '80'),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2,
        order: 2
      },
      {
        label: 'Duración Real (min)',
        data: durationComparisonData.map(d => d.realDuration),
        backgroundColor: durationComparisonData.map(d => {
          // Convertir el color a más oscuro
          const hex = d.color.replace('#', '')
          const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 60)
          const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 60)
          const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 60)
          return `rgb(${r}, ${g}, ${b})`
        }),
        borderColor: durationComparisonData.map(d => d.color),
        borderWidth: 2,
        order: 1
      }
    ]
  }

  const durationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} minutos`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
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
      
      {/* Gráficas de Tiempos Máximos Estimados */}
      <div className="comparison-charts">
        <div className="comparison-chart">
          <div className="chart-header">
            <h3>Duración Máxima Estimada WAD</h3>
            <ChartTooltip text="Compara la duración máxima estimada por el dispositivo WAD entre las sesiones. Este valor representa el tiempo total que el dispositivo estimó que podía funcionar con la batería disponible." />
          </div>
          <div className="chart-container">
            <Bar data={wadDurationChartData} options={durationOptions} />
          </div>
        </div>

        <div className="comparison-chart">
          <div className="chart-header">
            <h3>Duración Máxima Estimada Light Source</h3>
            <ChartTooltip text="Compara la duración máxima estimada por el Light Source entre las sesiones. Permite identificar diferencias en las estimaciones según el uso y la configuración." />
          </div>
          <div className="chart-container">
            <Bar data={lsDurationChartData} options={durationOptions} />
          </div>
        </div>
      </div>

      <div className="comparison-charts">
        <div className="comparison-chart">
          <div className="chart-header">
            <h3>Comparación WAD Battery</h3>
            <ChartTooltip text="Compara el comportamiento de la batería WAD entre múltiples cirugías normalizadas al 0-100% del tiempo total. Permite identificar patrones consistentes o anomalías." />
          </div>
          <div className="chart-container">
            <Line data={wadComparisonData} options={options} />
          </div>
        </div>

        <div className="comparison-chart">
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
              <div className="comparison-chart">
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
              <div className="comparison-chart">
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
              <div className="comparison-chart">
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
              <div className="comparison-chart">
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
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>Duración</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>WAD Inicial</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>WAD Final</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>WAD Consumo</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>WAD Duración</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>LS Inicial</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>LS Final</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>LS Consumo</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>LS Duración</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, idx) => {
              const batteryStats = session.data ? calculateStatistics(session.data) : null
              return (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.customName || `Sesión ${idx + 1}`}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.surgeryDate}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.duration} min</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.wadInitial}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.wadFinal}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.wadDrop?.toFixed(1)}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{batteryStats?.wad?.timeToOneMinute > 0 ? `${batteryStats.wad.timeToOneMinute.toFixed(1)} min` : 'N/A'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.lightSourceInitial}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.lightSourceFinal}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{session.summary.lightSourceDrop?.toFixed(1)}%</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{batteryStats?.lightSource?.timeToOneMinute > 0 ? `${batteryStats.lightSource.timeToOneMinute.toFixed(1)} min` : 'N/A'}</td>
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
