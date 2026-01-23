import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { processChartData } from '../utils/dataProcessor'
import ChartTooltip from './ChartTooltip'
import './BatteryChart.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function BatteryChart({ session }) {
  const chartData = processChartData(session.data)

  // Sample data every 6 points (1 minute) to reduce clutter
  const sampledIndices = chartData.labels
    .map((_, idx) => idx)
    .filter((_, idx) => idx % 6 === 0)

  const data = {
    labels: sampledIndices.map(i => chartData.labels[i]),
    datasets: [
      {
        label: 'WAD Battery %',
        data: sampledIndices.map(i => chartData.wadBattery[i]),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true
      },
      {
        label: 'Light Source Battery %',
        data: sampledIndices.map(i => chartData.lightSourceBattery[i]),
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true
      }
    ]
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
            size: 13,
            weight: '500'
          }
        }
      },
      title: {
        display: true,
        text: 'Nivel de Batería vs Tiempo de Cirugía',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: 20
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
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
          text: 'Tiempo de Cirugía',
          font: {
            size: 13,
            weight: '500'
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15
        },
        grid: {
          display: false
        }
      }
    }
  }

  return (
    <div className="battery-chart">
      <div className="chart-header">
        <h3>Nivel de Batería vs Tiempo de Cirugía</h3>
        <ChartTooltip text="Visualiza cómo evolucionan los niveles de batería del WAD y Light Source durante toda la cirugía. Permite identificar patrones de descarga y momentos críticos." />
      </div>
      <div className="chart-container">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export default BatteryChart
