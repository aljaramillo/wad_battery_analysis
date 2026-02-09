import { useMemo } from 'react'
import './SummaryCards.css'

function SummaryCards({ sessions }) {
  const cards = useMemo(() => {
    if (sessions.length === 0) return []

    const session = sessions[0]
    const summary = session.summary

    return [
      {
        title: 'Duración Total',
        value: `${summary.duration} min`,
        icon: '⏱️',
        color: '#667eea'
      },
      {
        title: 'WAD Consumo',
        value: `${summary.wadDrop?.toFixed(1)}%`,
        subtitle: `${summary.wadAvgConsumption?.toFixed(2)}% / min`,
        icon: '🔋',
        color: '#f093fb'
      },
      {
        title: 'Light Source Consumo',
        value: `${summary.lightSourceDrop?.toFixed(1)}%`,
        subtitle: `${summary.lightSourceAvgConsumption?.toFixed(2)}% / min`,
        icon: '💡',
        color: '#4facfe'
      },
      {
        title: 'Mediciones',
        value: summary.totalMeasurements || session.data.length,
        icon: '📊',
        color: '#43e97b'
      }
    ]
  }, [sessions])

  if (sessions.length === 0) return null

  return (
    <div className="summary-cards">
      {cards.map((card, idx) => (
        <div key={idx} className="summary-card" style={{ borderTopColor: card.color }}>
          <div className="card-icon" style={{ color: card.color }}>
            {card.icon}
          </div>
          <div className="card-content">
            <h4>{card.title}</h4>
            <div className="card-value">{card.value}</div>
            {card.subtitle && <div className="card-subtitle">{card.subtitle}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default SummaryCards
