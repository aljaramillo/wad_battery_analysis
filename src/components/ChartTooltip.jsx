import { useState } from 'react'
import './ChartTooltip.css'

function ChartTooltip({ text }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="chart-tooltip-container">
      <button
        className="tooltip-icon"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Información"
      >
        ⓘ
      </button>
      {isVisible && (
        <div className="tooltip-bubble">
          {text}
        </div>
      )}
    </div>
  )
}

export default ChartTooltip
