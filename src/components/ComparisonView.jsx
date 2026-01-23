import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { processChartData, getColorForSession } from '../utils/dataProcessor'
import ChartTooltip from './ChartTooltip'
import './ComparisonView.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  })

  const labels = Array.from({ length: 100 }, (_, i) => `${i}%`)

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
        beginAtZero: true,
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
          text: 'Progreso de Cirugía (%)',
          font: {
            size: 13,
            weight: '500'
          }
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10
        },
        grid: {
          display: false
        }
      }
    }
  }

  return (
    <div className="comparison-view">
      <h2>Vista de Comparación ({sessions.length} sesiones)</h2>
      
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

      <div className="comparison-table">
        <h3>Tabla Comparativa</h3>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Duración</th>
              <th>WAD Inicial</th>
              <th>WAD Final</th>
              <th>WAD Consumo</th>
              <th>LS Inicial</th>
              <th>LS Final</th>
              <th>LS Consumo</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, idx) => (
              <tr key={idx}>
                <td>{session.summary.surgeryDate}</td>
                <td>{session.summary.duration} min</td>
                <td>{session.summary.wadInitial}%</td>
                <td>{session.summary.wadFinal}%</td>
                <td>{session.summary.wadDrop?.toFixed(1)}%</td>
                <td>{session.summary.lightSourceInitial}%</td>
                <td>{session.summary.lightSourceFinal}%</td>
                <td>{session.summary.lightSourceDrop?.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparisonView
