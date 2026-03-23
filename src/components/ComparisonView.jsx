import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Line, Scatter, Bar } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
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
  buildWADCalibrationExperiment,
  buildWADCalibrationProfile,
  buildWADCalibrationTimelineExperiment,
  buildWADCalibrationTimelineProfile,
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
  Legend,
  zoomPlugin
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
            ctx.textBaseline = 'middle'
            ctx.translate(bar.x, bar.y - 18)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(value.toFixed(1), 0, 0)
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

const hexToRgba = (hexColor, alpha = 1) => {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
    return hexColor
  }

  const normalizedHex = hexColor.replace('#', '')
  const expandedHex = normalizedHex.length === 3
    ? normalizedHex.split('').map((char) => char + char).join('')
    : normalizedHex

  const red = parseInt(expandedHex.slice(0, 2), 16)
  const green = parseInt(expandedHex.slice(2, 4), 16)
  const blue = parseInt(expandedHex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function ComparisonView({ sessions }) {
  const [isCalibrationTooltipEnabled, setIsCalibrationTooltipEnabled] = useState(true)
  const [hiddenCalibrationGroups, setHiddenCalibrationGroups] = useState([])
  const [lowerToleranceMinutes, setLowerToleranceMinutes] = useState(8)
  const [upperToleranceMinutes, setUpperToleranceMinutes] = useState(8)
  const [focusSessionIndex, setFocusSessionIndex] = useState(0)
  const [hoveredCalibrationSeries, setHoveredCalibrationSeries] = useState(null)
  const [hoveredTimelineSeries, setHoveredTimelineSeries] = useState(null)
  const [isAltPressed, setIsAltPressed] = useState(false)
  const [hoveredPanChartKey, setHoveredPanChartKey] = useState(null)
  const [activePanChartKey, setActivePanChartKey] = useState(null)
  const batteryCalibrationChartRef = useRef(null)
  const timelineCalibrationChartRef = useRef(null)
  const isSyncingZoomRef = useRef(false)
  const safeFocusSessionIndex = Math.min(focusSessionIndex, Math.max(0, sessions.length - 1))

  const updateHoveredCalibrationSeries = (nextSeries) => {
    setHoveredCalibrationSeries((currentSeries) => {
      if (!nextSeries && !currentSeries) {
        return currentSeries
      }

      if (
        currentSeries
        && nextSeries
        && currentSeries.label === nextSeries.label
        && currentSeries.x === nextSeries.x
        && currentSeries.y === nextSeries.y
      ) {
        return currentSeries
      }

      return nextSeries
    })
  }

  const updateToleranceMinutes = (side, nextValue) => {
    const numericValue = Number(nextValue)
    if (Number.isNaN(numericValue)) {
      return
    }

    const clampedValue = Math.max(0, Math.min(60, numericValue))
    startTransition(() => {
      if (side === 'lower') {
        setLowerToleranceMinutes(clampedValue)
        return
      }

      setUpperToleranceMinutes(clampedValue)
    })
  }

  const updateHoveredTimelineSeries = (nextSeries) => {
    setHoveredTimelineSeries((currentSeries) => {
      if (!nextSeries && !currentSeries) {
        return currentSeries
      }

      if (
        currentSeries
        && nextSeries
        && currentSeries.label === nextSeries.label
        && currentSeries.x === nextSeries.x
        && currentSeries.y === nextSeries.y
      ) {
        return currentSeries
      }

      return nextSeries
    })
  }

  const toggleCalibrationGroup = (groupKey) => {
    setHiddenCalibrationGroups((currentGroups) => (
      (() => {
        const isVendorGroup = sessions.some((session) => `${session.customName || session.summary.surgeryDate} - Vendor WAD` === groupKey)
        const isCurrentlyHidden = currentGroups.includes(groupKey)

        if (!isVendorGroup) {
          return isCurrentlyHidden
            ? currentGroups.filter((currentGroup) => currentGroup !== groupKey)
            : [...currentGroups, groupKey]
        }

        const visibleVendorGroupCount = sessions.filter((session) => {
          const vendorGroupKey = `${session.customName || session.summary.surgeryDate} - Vendor WAD`
          return !currentGroups.includes(vendorGroupKey)
        }).length

        if (!isCurrentlyHidden && visibleVendorGroupCount <= 1) {
          return currentGroups
        }

        return isCurrentlyHidden
          ? currentGroups.filter((currentGroup) => currentGroup !== groupKey)
          : [...currentGroups, groupKey]
      })()
    ))
  }

  const getHoveredCalibrationLabel = (rawLabel) => {
    if (!rawLabel) {
      return ''
    }

    return rawLabel.endsWith(' - Vendor WAD')
      ? rawLabel.replace(' - Vendor WAD', '')
      : rawLabel
  }

  const getCalibrationChartKey = (chart) => {
    if (chart === batteryCalibrationChartRef.current) {
      return 'battery'
    }

    if (chart === timelineCalibrationChartRef.current) {
      return 'timeline'
    }

    return null
  }

  useEffect(() => {
    const isInteractiveTarget = (target) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      return Boolean(target.closest('input, textarea, select, button, [contenteditable="true"]'))
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Alt' || event.repeat || isInteractiveTarget(event.target)) {
        return
      }

      setIsAltPressed(true)
    }

    const handleKeyUp = (event) => {
      if (event.key !== 'Alt') {
        return
      }

      setIsAltPressed(false)
      setActivePanChartKey(null)
    }

    const handleWindowBlur = () => {
      setIsAltPressed(false)
      setActivePanChartKey(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [activePanChartKey, hoveredPanChartKey])

  const syncChartViewport = (sourceChart, targetChart) => {
    if (!sourceChart || !targetChart) {
      return
    }

    const sourceScale = sourceChart.scales?.x
    const sourceYScale = sourceChart.scales?.y
    const sourceInitialBounds = sourceChart.getInitialScaleBounds?.()
    const targetInitialBounds = targetChart.getInitialScaleBounds?.()
    const sourceXBounds = sourceInitialBounds?.x
    const targetXBounds = targetInitialBounds?.x
    const sourceYBounds = sourceInitialBounds?.y
    const targetYBounds = targetInitialBounds?.y

    if (!sourceScale || !sourceXBounds || !targetXBounds) {
      return
    }

    const sourceOriginalMin = typeof sourceXBounds.min === 'number' ? sourceXBounds.min : 0
    const sourceOriginalMax = typeof sourceXBounds.max === 'number' ? sourceXBounds.max : sourceOriginalMin + 1
    const targetOriginalMin = typeof targetXBounds.min === 'number' ? targetXBounds.min : 0
    const targetOriginalMax = typeof targetXBounds.max === 'number' ? targetXBounds.max : targetOriginalMin + 1
    const sourceVisibleMin = typeof sourceScale.min === 'number' ? sourceScale.min : sourceOriginalMin
    const sourceVisibleMax = typeof sourceScale.max === 'number' ? sourceScale.max : sourceOriginalMax
    const sourceSpan = Math.max(1, sourceOriginalMax - sourceOriginalMin)
    const targetSpan = Math.max(1, targetOriginalMax - targetOriginalMin)
    const startRatio = Math.max(0, Math.min(1, (sourceVisibleMin - sourceOriginalMin) / sourceSpan))
    const endRatio = Math.max(startRatio, Math.min(1, (sourceVisibleMax - sourceOriginalMin) / sourceSpan))
    const nextMin = targetOriginalMin + (startRatio * targetSpan)
    const nextMax = targetOriginalMin + (endRatio * targetSpan)

    targetChart.zoomScale?.('x', {
      min: nextMin,
      max: nextMax
    }, 'none')

    if (sourceYScale && targetYBounds) {
      const sourceYMin = typeof sourceYScale.min === 'number' ? sourceYScale.min : undefined
      const sourceYMax = typeof sourceYScale.max === 'number' ? sourceYScale.max : undefined
      const targetOriginalYMin = typeof targetYBounds.min === 'number' ? targetYBounds.min : sourceYMin
      const targetOriginalYMax = typeof targetYBounds.max === 'number' ? targetYBounds.max : sourceYMax

      if (sourceYMin == null && sourceYMax == null) {
        return
      }

      targetChart.zoomScale?.('y', {
        min: sourceYMin != null ? Math.max(targetOriginalYMin ?? sourceYMin, sourceYMin) : targetOriginalYMin,
        max: sourceYMax != null ? Math.min(targetOriginalYMax ?? sourceYMax, sourceYMax) : targetOriginalYMax
      }, 'none')
    }
  }

  const syncCalibrationZoom = (sourceChart) => {
    if (isSyncingZoomRef.current) {
      return
    }

    const batteryChart = batteryCalibrationChartRef.current
    const timelineChart = timelineCalibrationChartRef.current
    const targetChart = sourceChart === batteryChart ? timelineChart : batteryChart

    if (!targetChart) {
      return
    }

    isSyncingZoomRef.current = true

    try {
      syncChartViewport(sourceChart, targetChart)
    } finally {
      isSyncingZoomRef.current = false
    }
  }

  const startSynchronizedPan = (chart, panEvent) => {
    const nativeEvent = panEvent?.srcEvent

    if (!nativeEvent?.altKey) {
      return false
    }

    const chartKey = getCalibrationChartKey(chart)
    setActivePanChartKey(chartKey)
    return true
  }

  const handleSynchronizedPan = (chart) => {
    syncCalibrationZoom(chart)
  }

  const completeSynchronizedPan = (chart) => {
    syncCalibrationZoom(chart)
    setActivePanChartKey(null)
  }

  const resetChartZoom = () => {
    isSyncingZoomRef.current = true

    try {
      batteryCalibrationChartRef.current?.resetZoom?.()
      timelineCalibrationChartRef.current?.resetZoom?.()
    } finally {
      isSyncingZoomRef.current = false
    }
  }

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
  const visibleFocusSessions = useMemo(
    () => sessions
      .map((session, index) => ({
        index,
        label: session.customName || session.summary.surgeryDate,
        hidden: hiddenCalibrationGroups.includes(`${session.customName || session.summary.surgeryDate} - Vendor WAD`)
      }))
      .filter((session) => !session.hidden),
    [hiddenCalibrationGroups, sessions]
  )
  const effectiveFocusSessionIndex = useMemo(() => {
    if (visibleFocusSessions.length === 0) {
      return safeFocusSessionIndex
    }

    const currentFocusStillVisible = visibleFocusSessions.some((session) => session.index === safeFocusSessionIndex)
    if (currentFocusStillVisible) {
      return safeFocusSessionIndex
    }

    const nextVisibleSession = visibleFocusSessions.find((session) => session.index > safeFocusSessionIndex)
    return nextVisibleSession?.index ?? visibleFocusSessions[visibleFocusSessions.length - 1].index
  }, [safeFocusSessionIndex, visibleFocusSessions])
  const visibleCalibrationSessions = useMemo(
    () => visibleFocusSessions.map((session) => sessions[session.index]),
    [sessions, visibleFocusSessions]
  )
  const focusSession = sessions[effectiveFocusSessionIndex]
  const focusSessionLabel = focusSession.customName || focusSession.summary.surgeryDate

  useEffect(() => {
    if (effectiveFocusSessionIndex !== focusSessionIndex) {
      setFocusSessionIndex(effectiveFocusSessionIndex)
    }
  }, [effectiveFocusSessionIndex, focusSessionIndex])
  const wadCalibrationProfiles = useMemo(
    () => sessions.map((session, index) => ({
      label: session.customName || session.summary.surgeryDate,
      color: getColorForSession(index),
      profile: buildWADCalibrationProfile(session.data)
    })),
    [sessions]
  )

  const wadCalibrationExperiment = useMemo(
    () => buildWADCalibrationExperiment(focusSession, visibleCalibrationSessions, {
      lowerToleranceMinutes,
      upperToleranceMinutes
    }),
    [focusSession, lowerToleranceMinutes, upperToleranceMinutes, visibleCalibrationSessions]
  )

  const wadCalibrationTimelineProfiles = useMemo(
    () => sessions.map((session, index) => ({
      label: session.customName || session.summary.surgeryDate,
      color: getColorForSession(index),
      profile: buildWADCalibrationTimelineProfile(session.data)
    })),
    [sessions]
  )

  const wadCalibrationTimelineExperiment = useMemo(
    () => buildWADCalibrationTimelineExperiment(focusSession, visibleCalibrationSessions, {
      lowerToleranceMinutes,
      upperToleranceMinutes
    }),
    [focusSession, lowerToleranceMinutes, upperToleranceMinutes, visibleCalibrationSessions]
  )

  const wadLegendItems = useMemo(
    () => wadCalibrationProfiles.map((sessionProfile) => ({
      groupKey: `${sessionProfile.label} - Vendor WAD`,
      label: sessionProfile.label,
      color: sessionProfile.color,
      lineStyle: 'solid',
      emphasis: sessionProfile.label === focusSessionLabel,
      hidden: hiddenCalibrationGroups.includes(`${sessionProfile.label} - Vendor WAD`)
    })),
    [focusSessionLabel, hiddenCalibrationGroups, wadCalibrationProfiles]
  )

  const calibrationReferenceLegendItems = useMemo(
    () => [
      {
        groupKey: 'Tiempo real restante (min)',
        label: 'Tiempo real restante (sesion foco)',
        color: '#e74c3c',
        lineStyle: 'dashed',
        hidden: hiddenCalibrationGroups.includes('Tiempo real restante (min)')
      },
      {
        groupKey: 'Estimacion propia media (min)',
        label: 'Estimacion propia media',
        color: '#14967f',
        lineStyle: 'solid',
        hidden: hiddenCalibrationGroups.includes('Estimacion propia media (min)')
      },
      {
        groupKey: 'Banda de activacion',
        label: 'Banda de activacion',
        color: 'rgba(241, 196, 15, 0.95)',
        lineStyle: 'dashed',
        hidden: hiddenCalibrationGroups.includes('Banda de activacion')
      },
      {
        groupKey: 'Fallback activado',
        label: 'Fallback activado',
        color: '#d35400',
        lineStyle: 'point',
        hidden: hiddenCalibrationGroups.includes('Fallback activado')
      }
    ],
    [hiddenCalibrationGroups]
  )

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

  const wadCalibrationChartData = useMemo(() => ({
    labels: wadCalibrationExperiment.batteryLabels,
    datasets: [
      ...wadCalibrationProfiles.map((sessionProfile) => ({
        legendGroup: `${sessionProfile.label} - Vendor WAD`,
        label: `${sessionProfile.label} - Vendor WAD`,
        data: sessionProfile.profile.map((point) => point.vendorEstimateMin),
        borderColor: sessionProfile.label === focusSessionLabel
          ? sessionProfile.color
          : hexToRgba(sessionProfile.color, 0.5),
        backgroundColor: sessionProfile.label === focusSessionLabel
          ? sessionProfile.color
          : hexToRgba(sessionProfile.color, 0.5),
        borderWidth: sessionProfile.label === focusSessionLabel ? 3 : 1.4,
        order: 10,
        hidden: hiddenCalibrationGroups.includes(`${sessionProfile.label} - Vendor WAD`),
        pointRadius: 0,
        tension: 0.2,
        spanGaps: false
      })),
      {
        legendGroup: 'Tiempo real restante (min)',
        label: 'Tiempo real restante (min)',
        data: wadCalibrationExperiment.bucketSeries.map((point) => point.actualRemainingMin),
        borderColor: '#e74c3c',
        borderWidth: 3.5,
        borderDash: [6, 4],
        order: 4,
        hidden: hiddenCalibrationGroups.includes('Tiempo real restante (min)'),
        pointRadius: 0,
        tension: 0.25,
        spanGaps: false
      },
      {
        legendGroup: 'Estimacion propia media (min)',
        label: 'Estimacion propia media (min)',
        data: wadCalibrationExperiment.bucketSeries.map((point) => point.ownEstimateMin),
        borderColor: '#14967f',
        backgroundColor: 'rgba(20, 150, 127, 0.08)',
        borderWidth: 3.5,
        order: 3,
        hidden: hiddenCalibrationGroups.includes('Estimacion propia media (min)'),
        pointRadius: 0,
        tension: 0.25,
        spanGaps: false
      },
      {
        legendGroup: 'Banda de activacion',
        label: 'Limite superior activacion',
        data: wadCalibrationExperiment.bucketSeries.map((point) => point.upperBoundMin),
        borderColor: 'rgba(241, 196, 15, 0.95)',
        borderWidth: 2.5,
        borderDash: [4, 4],
        order: 2,
        hidden: hiddenCalibrationGroups.includes('Banda de activacion'),
        pointRadius: 0,
        tension: 0.2,
        spanGaps: false
      },
      {
        legendGroup: 'Banda de activacion',
        label: 'Limite inferior activacion',
        data: wadCalibrationExperiment.bucketSeries.map((point) => point.lowerBoundMin),
        borderColor: 'rgba(241, 196, 15, 0.95)',
        borderWidth: 2.5,
        borderDash: [4, 4],
        order: 2,
        hidden: hiddenCalibrationGroups.includes('Banda de activacion'),
        pointRadius: 0,
        tension: 0.2,
        spanGaps: false
      },
      {
        legendGroup: 'Fallback activado',
        label: 'Fallback activado',
        data: wadCalibrationExperiment.bucketSeries.map((point) => point.shouldActivateOwnEstimate ? point.ownEstimateMin : null),
        borderColor: '#d35400',
        backgroundColor: '#d35400',
        borderWidth: 0,
        order: 1,
        hidden: hiddenCalibrationGroups.includes('Fallback activado'),
        showLine: false,
        pointRadius: 5,
        pointHoverRadius: 6,
        spanGaps: false
      }
    ]
  }), [focusSessionLabel, hiddenCalibrationGroups, wadCalibrationExperiment, wadCalibrationProfiles])

  const wadCalibrationOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, activeElements, chart) => {
      if (isCalibrationTooltipEnabled) {
        updateHoveredCalibrationSeries(null)
        return
      }

      const activeElement = activeElements[0]
      if (!activeElement) {
        updateHoveredCalibrationSeries(null)
        return
      }

      const hoveredDataset = chart.data.datasets[activeElement.datasetIndex]
      updateHoveredCalibrationSeries({
        label: getHoveredCalibrationLabel(hoveredDataset?.label || ''),
        x: event.x,
        y: event.y
      })
    },
    interaction: {
      mode: isCalibrationTooltipEnabled ? 'index' : 'nearest',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: isCalibrationTooltipEnabled,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        padding: 12,
        callbacks: {
          afterBody: (items) => {
            const point = wadCalibrationExperiment.bucketSeries[items[0]?.dataIndex]
            if (!point) return []

            return [
              `Bucket bateria: ${point.batteryBucket}%`,
              `Muestras agregadas: ${point.aggregateSampleCount}`,
              `Activar fallback: ${point.shouldActivateOwnEstimate ? 'si' : 'no'}`
            ]
          }
        }
      },
      zoom: {
        limits: {
          x: { min: 'original', max: 'original' },
          y: { min: 0, max: 300 }
        },
        pan: {
          enabled: true,
          mode: 'xy',
          modifierKey: 'alt',
          threshold: 2,
          onPan: ({ chart }) => handleSynchronizedPan(chart),
          onPanStart: ({ chart, event }) => startSynchronizedPan(chart, event),
          onPanComplete: ({ chart }) => completeSynchronizedPan(chart)
        },
        zoom: {
          mode: 'xy',
          onZoomComplete: ({ chart }) => syncCalibrationZoom(chart),
          wheel: {
            enabled: true,
            modifierKey: 'alt'
          },
          pinch: {
            enabled: false
          },
          drag: {
            enabled: false
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 300, // EJE Y fijo para mostrar bien la banda de activación y evitar zooms extremos
        title: {
          display: true,
          text: 'Estimacion temporal (minutos)',
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
          text: `Comparativa por porcentaje de bateria | Sesion foco: ${focusSessionLabel}`,
          font: {
            size: 13,
            weight: '500'
          }
        },
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 11
        },
        grid: {
          display: false
        }
      }
    }
  }), [focusSessionLabel, isCalibrationTooltipEnabled, wadCalibrationExperiment])

  const wadCalibrationTimelineChartData = useMemo(() => ({
    labels: wadCalibrationTimelineExperiment.timeLabels,
    datasets: [
      ...wadCalibrationTimelineProfiles.map((sessionProfile) => ({
        legendGroup: `${sessionProfile.label} - Vendor WAD`,
        label: `${sessionProfile.label} - Vendor WAD`,
        data: sessionProfile.profile.map((point) => point.vendorEstimateMin),
        borderColor: sessionProfile.label === focusSessionLabel
          ? sessionProfile.color
          : hexToRgba(sessionProfile.color, 0.15),
        backgroundColor: sessionProfile.label === focusSessionLabel
          ? sessionProfile.color
          : hexToRgba(sessionProfile.color, 0.15),
        borderWidth: sessionProfile.label === focusSessionLabel ? 3 : 1.4,
        order: 10,
        hidden: hiddenCalibrationGroups.includes(`${sessionProfile.label} - Vendor WAD`),
        pointRadius: 0,
        tension: 0,
        spanGaps: false
      })),
      {
        legendGroup: 'Tiempo real restante (min)',
        label: 'Tiempo real restante (min)',
        data: wadCalibrationTimelineExperiment.timeSeries.map((point) => point.actualRemainingMin),
        borderColor: '#e74c3c',
        borderWidth: 3.5,
        borderDash: [6, 4],
        order: 4,
        hidden: hiddenCalibrationGroups.includes('Tiempo real restante (min)'),
        pointRadius: 0,
        tension: 0,
        spanGaps: false
      },
      {
        legendGroup: 'Estimacion propia media (min)',
        label: 'Estimacion propia media (min)',
        data: wadCalibrationTimelineExperiment.timeSeries.map((point) => point.ownEstimateMin),
        borderColor: '#14967f',
        backgroundColor: 'rgba(20, 150, 127, 0.08)',
        borderWidth: 3.5,
        order: 3,
        hidden: hiddenCalibrationGroups.includes('Estimacion propia media (min)'),
        pointRadius: 0,
        tension: 0,
        spanGaps: false
      },
      {
        legendGroup: 'Banda de activacion',
        label: 'Limite superior activacion',
        data: wadCalibrationTimelineExperiment.timeSeries.map((point) => point.upperBoundMin),
        borderColor: 'rgba(241, 196, 15, 0.95)',
        borderWidth: 2.5,
        borderDash: [4, 4],
        order: 2,
        hidden: hiddenCalibrationGroups.includes('Banda de activacion'),
        pointRadius: 0,
        tension: 0,
        spanGaps: false
      },
      {
        legendGroup: 'Banda de activacion',
        label: 'Limite inferior activacion',
        data: wadCalibrationTimelineExperiment.timeSeries.map((point) => point.lowerBoundMin),
        borderColor: 'rgba(241, 196, 15, 0.95)',
        borderWidth: 2.5,
        borderDash: [4, 4],
        order: 2,
        hidden: hiddenCalibrationGroups.includes('Banda de activacion'),
        pointRadius: 0,
        tension: 0,
        spanGaps: false
      },
      {
        legendGroup: 'Fallback activado',
        label: 'Fallback activado',
        data: wadCalibrationTimelineExperiment.timeSeries.map((point) => point.shouldActivateOwnEstimate ? point.ownEstimateMin : null),
        borderColor: '#d35400',
        backgroundColor: '#d35400',
        borderWidth: 0,
        order: 1,
        hidden: hiddenCalibrationGroups.includes('Fallback activado'),
        showLine: false,
        pointRadius: 5,
        pointHoverRadius: 6,
        spanGaps: false
      }
    ]
  }), [focusSessionLabel, hiddenCalibrationGroups, wadCalibrationTimelineExperiment, wadCalibrationTimelineProfiles])

  const wadCalibrationTimelineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, activeElements, chart) => {
      if (isCalibrationTooltipEnabled) {
        updateHoveredTimelineSeries(null)
        return
      }

      const activeElement = activeElements[0]
      if (!activeElement) {
        updateHoveredTimelineSeries(null)
        return
      }

      const hoveredDataset = chart.data.datasets[activeElement.datasetIndex]
      updateHoveredTimelineSeries({
        label: getHoveredCalibrationLabel(hoveredDataset?.label || ''),
        x: event.x,
        y: event.y
      })
    },
    interaction: {
      mode: isCalibrationTooltipEnabled ? 'index' : 'nearest',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: isCalibrationTooltipEnabled,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        padding: 12,
        callbacks: {
          title: (items) => {
            const elapsedMinute = items[0]?.label
            return elapsedMinute == null ? '' : `Minuto ${elapsedMinute}`
          },
          afterBody: (items) => {
            const point = wadCalibrationTimelineExperiment.timeSeries[items[0]?.dataIndex]
            if (!point) return []

            return [
              `Sesiones activas en ese minuto: ${point.aggregateSampleCount}`,
              `Activar fallback: ${point.shouldActivateOwnEstimate ? 'si' : 'no'}`
            ]
          }
        }
      },
      zoom: {
        limits: {
          x: { min: 'original', max: 'original' },
          y: { min: 0, max: 300 }
        },
        pan: {
          enabled: true,
          mode: 'xy',
          modifierKey: 'alt',
          threshold: 2,
          onPan: ({ chart }) => handleSynchronizedPan(chart),
          onPanStart: ({ chart, event }) => startSynchronizedPan(chart, event),
          onPanComplete: ({ chart }) => completeSynchronizedPan(chart)
        },
        zoom: {
          mode: 'xy',
          onZoomComplete: ({ chart }) => syncCalibrationZoom(chart),
          wheel: {
            enabled: true,
            modifierKey: 'alt'
          },
          pinch: {
            enabled: false
          },
          drag: {
            enabled: false
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 300, // EJE Y fijo para mostrar bien la banda de activación y evitar zooms extremos
        title: {
          display: true,
          text: 'Estimacion temporal (minutos)',
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
          text: `Tiempo transcurrido real (min) | Sesion foco: ${focusSessionLabel}`,
          font: {
            size: 13,
            weight: '500'
          }
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 14,
          callback: function(value) {
            return `${this.getLabelForValue(value)} min`
          }
        },
        grid: {
          display: false
        }
      }
    }
  }), [focusSessionLabel, isCalibrationTooltipEnabled, wadCalibrationTimelineExperiment])

  return (
    <div className="comparison-view">
      <h2>Vista de Comparación ({sessions.length} sesiones)</h2>

      <div className="comparison-calibration-panel">
        <div className="comparison-calibration-header">
          <div className="chart-header">
            <h3>Calibracion experimental WAD</h3>
            <ChartTooltip text="Usa todas las sesiones seleccionadas sobre un eje comun de porcentaje de bateria. Cada curva de color representa la estimacion vendor de una sesion WAD. La linea verde es la estimacion propia basada en la media real agregada, y las lineas amarillas delimitan la banda donde el vendor seguiria siendo aceptable para la sesion foco." />
          </div>
          <div className="comparison-calibration-intros">
            <div className="comparison-calibration-intro-card">
              <h4>Vista por bateria</h4>
              <div className="comparison-calibration-explanation">
                <p>
                  Este grafico compara todas las estimaciones WAD sobre una misma escala: el porcentaje de bateria. Asi puedes ver si varios WAD cuentan una historia parecida o si alguno se desvía demasiado.
                </p>
                <p>
                  Las lineas de colores son lo que reporta cada WAD. La linea roja marca el tiempo real restante de la sesion foco. La verde es la estimacion propia calculada con la media real observada entre los WADs visibles para ese mismo porcentaje de bateria.
                </p>
                <p>
                  Las lineas amarillas forman una banda de tolerancia. Si la estimacion vendor de la sesion foco se sale de esa banda, los puntos naranjas indican que ahi entraria vuestro fallback.
                </p>
                <p className="comparison-calibration-usage-note">
                  Interaccion: Alt + rueda para zoom en X e Y. Alt + arrastrar para navegar.
                </p>
              </div>
            </div>

            <div className="comparison-calibration-intro-card">
              <h4>Vista por tiempo real</h4>
              <div className="comparison-calibration-explanation">
                <p>
                  Esta vista usa el tiempo real en el eje X. Por eso las curvas de cada WAD terminan exactamente cuando acaba su sesion y la linea roja de la sesion foco cae como una diagonal natural hasta cero.
                </p>
                <p>
                  La linea verde ya no es una media por porcentaje de bateria, sino la media del tiempo restante que quedaba en ese minuto entre los WADs visibles que seguian activos. La banda amarilla usa una tolerancia inferior y otra superior para poder afinar mejor el criterio.
                </p>
                <p className="comparison-calibration-usage-note">
                  Interaccion: Alt + rueda para zoom en X e Y. Alt + arrastrar para navegar.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`comparison-chart comparison-calibration-chart${isAltPressed && hoveredPanChartKey === 'battery' ? ' is-pan-ready' : ''}${activePanChartKey === 'battery' ? ' is-panning' : ''}`}
          style={{ backgroundColor: '#f6fcfb' }}
          onMouseEnter={() => setHoveredPanChartKey('battery')}
          onMouseLeave={() => setHoveredPanChartKey((current) => (current === 'battery' ? null : current))}
        >
          <div className="chart-container" style={{ height: '700px', minHeight: '700px' }}>
            <Line ref={batteryCalibrationChartRef} data={wadCalibrationChartData} options={wadCalibrationOptions} />
            {!isCalibrationTooltipEnabled && hoveredCalibrationSeries?.label && (
              <div
                className="comparison-calibration-hover-tooltip"
                style={{
                  left: `${hoveredCalibrationSeries.x + 10}px`,
                  top: `${hoveredCalibrationSeries.y + 10}px`
                }}
              >
                {hoveredCalibrationSeries.label}
              </div>
            )}
          </div>
        </div>

        <div className="comparison-calibration-center-panel">
          <div className="comparison-calibration-legend is-centered">
            <div className="comparison-calibration-legend-items is-centered">
              {wadLegendItems.map((item) => (
                <button
                  key={item.groupKey}
                  type="button"
                  className={`comparison-calibration-legend-item${item.emphasis ? ' is-emphasis' : ''}${item.hidden ? ' is-hidden' : ''}`}
                  onClick={() => toggleCalibrationGroup(item.groupKey)}
                  aria-pressed={!item.hidden}
                >
                  <span className={`comparison-calibration-legend-swatch is-${item.lineStyle}`} style={{ '--legend-color': item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="comparison-calibration-legend-items is-secondary-row is-centered">
              {calibrationReferenceLegendItems.map((item) => (
                <button
                  key={item.groupKey}
                  type="button"
                  className={`comparison-calibration-legend-item${item.hidden ? ' is-hidden' : ''}`}
                  onClick={() => toggleCalibrationGroup(item.groupKey)}
                  aria-pressed={!item.hidden}
                >
                  <span className={`comparison-calibration-legend-swatch is-${item.lineStyle}`} style={{ '--legend-color': item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="comparison-calibration-metrics is-single-row">
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">WADs</span>
              <strong>{visibleCalibrationSessions.length} / {sessions.length}</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Sesion foco</span>
              <strong>{focusSessionLabel}</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Tol. inferior</span>
              <strong>-{wadCalibrationExperiment.lowerToleranceMinutes} min</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Tol. superior</span>
              <strong>+{wadCalibrationExperiment.upperToleranceMinutes} min</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Fallback bateria</span>
              <strong>{wadCalibrationExperiment.activationCount} / {wadCalibrationExperiment.bucketSeries.length}</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Cobertura bateria</span>
              <strong>{wadCalibrationExperiment.coverageCount}</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Duracion foco</span>
              <strong>{wadCalibrationTimelineExperiment.focusDurationMin} min</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Horizonte</span>
              <strong>{wadCalibrationTimelineExperiment.maxElapsedMinute} min</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Fallback tiempo</span>
              <strong>{wadCalibrationTimelineExperiment.activationCount} / {wadCalibrationTimelineExperiment.timeSeries.length}</strong>
            </div>
            <div className="comparison-calibration-chip is-compact">
              <span className="comparison-calibration-label">Cobertura tiempo</span>
              <strong>{wadCalibrationTimelineExperiment.coverageCount}</strong>
            </div>
          </div>

          <div className="comparison-calibration-toolbar is-below-chart is-centered-layout">
            <div className="comparison-calibration-focus-control">
              <label className="comparison-calibration-focus-label" htmlFor="wad-focus-session">
                Sesion foco
              </label>
              <select
                id="wad-focus-session"
                className="comparison-calibration-focus-select"
                value={effectiveFocusSessionIndex}
                onChange={(event) => {
                  const nextIndex = Number(event.target.value)
                  if (!Number.isNaN(nextIndex)) {
                    setFocusSessionIndex(nextIndex)
                  }
                }}
              >
                {visibleFocusSessions.map((session) => (
                  <option key={`${session.label}-${session.index}`} value={session.index}>
                    {session.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="comparison-calibration-tolerance-control">
              <label className="comparison-calibration-tolerance-label" htmlFor="wad-tolerance-lower-range">
                Tolerancia inferior
              </label>
              <input
                id="wad-tolerance-lower-range"
                className="comparison-calibration-tolerance-range"
                type="range"
                min="0"
                max="60"
                step="1"
                value={lowerToleranceMinutes}
                onChange={(event) => updateToleranceMinutes('lower', event.target.value)}
              />
              <input
                className="comparison-calibration-tolerance-input"
                type="number"
                min="0"
                max="60"
                step="1"
                value={lowerToleranceMinutes}
                onChange={(event) => updateToleranceMinutes('lower', event.target.value)}
                aria-label="Tolerancia inferior en minutos"
              />
              <span className="comparison-calibration-tolerance-suffix">min</span>
            </div>

            <div className="comparison-calibration-tolerance-control">
              <label className="comparison-calibration-tolerance-label" htmlFor="wad-tolerance-upper-range">
                Tolerancia superior
              </label>
              <input
                id="wad-tolerance-upper-range"
                className="comparison-calibration-tolerance-range"
                type="range"
                min="0"
                max="60"
                step="1"
                value={upperToleranceMinutes}
                onChange={(event) => updateToleranceMinutes('upper', event.target.value)}
              />
              <input
                className="comparison-calibration-tolerance-input"
                type="number"
                min="0"
                max="60"
                step="1"
                value={upperToleranceMinutes}
                onChange={(event) => updateToleranceMinutes('upper', event.target.value)}
                aria-label="Tolerancia superior en minutos"
              />
              <span className="comparison-calibration-tolerance-suffix">min</span>
            </div>

            <button
              type="button"
              className="comparison-calibration-zoom-reset"
              onClick={resetChartZoom}
            >
              Reset zoom
            </button>

            <label className="comparison-calibration-toggle">
              <input
                type="checkbox"
                checked={isCalibrationTooltipEnabled}
                onChange={(event) => setIsCalibrationTooltipEnabled(event.target.checked)}
              />
              <span>Tooltip completo</span>
            </label>
          </div>
        </div>

        <div className="comparison-calibration-subsection">
          <div
            className={`comparison-chart comparison-calibration-chart is-timeline${isAltPressed && hoveredPanChartKey === 'timeline' ? ' is-pan-ready' : ''}${activePanChartKey === 'timeline' ? ' is-panning' : ''}`}
            style={{ backgroundColor: '#fffaf1' }}
            onMouseEnter={() => setHoveredPanChartKey('timeline')}
            onMouseLeave={() => setHoveredPanChartKey((current) => (current === 'timeline' ? null : current))}
          >
            <div className="chart-container" style={{ height: '700px', minHeight: '700px' }}>
              <Line ref={timelineCalibrationChartRef} data={wadCalibrationTimelineChartData} options={wadCalibrationTimelineOptions} />
              {!isCalibrationTooltipEnabled && hoveredTimelineSeries?.label && (
                <div
                  className="comparison-calibration-hover-tooltip"
                  style={{
                    left: `${hoveredTimelineSeries.x + 10}px`,
                    top: `${hoveredTimelineSeries.y + 10}px`
                  }}
                >
                  {hoveredTimelineSeries.label}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      
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
