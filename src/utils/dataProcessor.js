export const processChartData = (data) => {
  return {
    labels: data.map(row => row['Surgery Time']),
    wadBattery: data.map(row => row['WAD Battery %']),
    wadDuration: data.map(row => row['WAD Duration (min)']),
    wadQuality: data.map(row => row['WAD Quality']),
    lightSourceBattery: data.map(row => row['Light Source %']),
    lightSourceDuration: data.map(row => row['Light Source Duration (min)']),
    lightSourceIntensity: data.map(row => row['Light Source Intensity']),
  }
}

export const calculateStatistics = (data) => {
  // Filtrar valores -1 (dispositivo apagado) para cálculos estadísticos
  const wadBattery = data.map(row => row['WAD Battery %']).filter(v => v != null && v >= 0)
  const lsBattery = data.map(row => row['Light Source %']).filter(v => v != null && v >= 0)
  const wadDuration = data.map(row => row['WAD Duration (min)']).filter(v => v != null && v > 0)
  const lsDuration = data.map(row => row['Light Source Duration (min)']).filter(v => v != null && v > 0)

  // Encontrar índice del primer y último valor válido de batería
  const wadBatteryRaw = data.map(row => row['WAD Battery %'])
  const lsBatteryRaw = data.map(row => row['Light Source %'])
  
  const firstValidWadIdx = wadBatteryRaw.findIndex(v => v >= 0)
  const lastValidWadIdx = wadBatteryRaw.findLastIndex(v => v >= 0)
  const firstValidLsIdx = lsBatteryRaw.findIndex(v => v >= 0)
  const lastValidLsIdx = lsBatteryRaw.findLastIndex(v => v >= 0)

  // Calcular el tiempo real de cada dispositivo (desde su inicio hasta su fin)
  const wadRealTime = (lastValidWadIdx - firstValidWadIdx) / 6 // minutos
  const lsRealTime = (lastValidLsIdx - firstValidLsIdx) / 6 // minutos

  return {
    wad: {
      initial: firstValidWadIdx >= 0 ? wadBatteryRaw[firstValidWadIdx] : 0,
      final: lastValidWadIdx >= 0 ? wadBatteryRaw[lastValidWadIdx] : 0,
      drop: firstValidWadIdx >= 0 && lastValidWadIdx >= 0 
        ? wadBatteryRaw[firstValidWadIdx] - wadBatteryRaw[lastValidWadIdx] 
        : 0,
      avgConsumption: wadRealTime > 0 && firstValidWadIdx >= 0 && lastValidWadIdx >= 0
        ? (wadBatteryRaw[firstValidWadIdx] - wadBatteryRaw[lastValidWadIdx]) / wadRealTime 
        : 0,
      maxDurationEstimate: wadDuration.length > 0 ? Math.max(...wadDuration) : 0,
      minDurationEstimate: wadDuration.length > 0 ? Math.min(...wadDuration.filter(v => v > 0)) : 0,
    },
    lightSource: {
      initial: firstValidLsIdx >= 0 ? lsBatteryRaw[firstValidLsIdx] : 0,
      final: lastValidLsIdx >= 0 ? lsBatteryRaw[lastValidLsIdx] : 0,
      drop: firstValidLsIdx >= 0 && lastValidLsIdx >= 0 
        ? lsBatteryRaw[firstValidLsIdx] - lsBatteryRaw[lastValidLsIdx] 
        : 0,
      avgConsumption: lsRealTime > 0 && firstValidLsIdx >= 0 && lastValidLsIdx >= 0
        ? (lsBatteryRaw[firstValidLsIdx] - lsBatteryRaw[lastValidLsIdx]) / lsRealTime 
        : 0,
      maxDurationEstimate: lsDuration.length > 0 ? Math.max(...lsDuration) : 0,
      minDurationEstimate: lsDuration.length > 0 ? Math.min(...lsDuration.filter(v => v > 0)) : 0,
    }
  }
}

export const analyzeDurationAccuracy = (data) => {
  const results = []
  
  // Calcular el tiempo real de cada dispositivo basándose en cuándo llegan a -1
  const wadEndIndex = data.findIndex(row => row['WAD Battery %'] < 0)
  const lsEndIndex = data.findIndex(row => row['Light Source %'] < 0)
  
  const wadTotalTime = wadEndIndex >= 0 ? wadEndIndex / 6 : data.length / 6
  const lsTotalTime = lsEndIndex >= 0 ? lsEndIndex / 6 : data.length / 6
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const timeElapsed = i / 6 // minutes elapsed (every 10 seconds)
    const wadEstimate = row['WAD Duration (min)']
    const lsEstimate = row['Light Source Duration (min)']
    const wadBattery = row['WAD Battery %']
    const lsBattery = row['Light Source %']
    
    // Ignorar filas donde los dispositivos están apagados (-1)
    if (wadBattery < 0 || lsBattery < 0) continue
    
    // Calculate how much time is actually remaining for each device independently
    const wadActualRemaining = wadTotalTime - timeElapsed
    const lsActualRemaining = lsTotalTime - timeElapsed
    
    if (wadEstimate > 0) {
      results.push({
        time: row['Surgery Time'],
        wadEstimate,
        wadActual: wadActualRemaining,
        wadError: Math.abs(wadEstimate - wadActualRemaining),
        lsEstimate: lsEstimate || 0,
        lsActual: lsActualRemaining,
        lsError: lsEstimate ? Math.abs(lsEstimate - lsActualRemaining) : 0
      })
    }
  }
  
  return results
}

export const getColorForSession = (index) => {
  const colors = [
    '#667eea',
    '#f093fb',
    '#4facfe',
    '#43e97b',
    '#fa709a',
    '#feca57',
    '#48dbfb',
    '#ff9ff3'
  ]
  return colors[index % colors.length]
}
