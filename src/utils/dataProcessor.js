// ========== FASE 1: DETECCIÓN CORRECTA DEL FIN DE DISPOSITIVOS ==========

/**
 * Encuentra el último bloque continuo de valores -1 y retorna el último índice válido
 * antes de ese bloque final. 
 * IMPORTANTE: Un valor -1 indica apagado. Un valor 0 es válido (0% batería o intensidad 0).
 */
const findLastValidIndex = (data, field) => {
  const values = data.map(row => row[field])
  
  // Buscar desde el final hacia atrás el primer valor que NO sea -1
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== -1) {
      return i
    }
  }
  
  return -1 // Todo el array es -1
}

/**
 * Encuentra el índice donde empieza el último bloque continuo de -1
 */
const findFinalShutdownIndex = (data, field) => {
  const lastValidIdx = findLastValidIndex(data, field)
  
  if (lastValidIdx < 0) return 0 // Todo es -1
  if (lastValidIdx === data.length - 1) return data.length // No hay bloque final de -1
  
  return lastValidIdx + 1 // El siguiente índice después del último válido
}

// ========== FASE 2: SEPARAR DATOS POR DISPOSITIVO ==========

/**
 * Retorna solo los datos válidos del WAD (hasta que batería < 0)
 */
export const getWADValidData = (data) => {
  const endIdx = findFinalShutdownIndex(data, 'WAD Battery %')
  return data.slice(0, endIdx)
}

/**
 * Retorna solo los datos válidos de la LS (hasta el último bloque continuo de intensidad -1)
 * IMPORTANTE: Usa 'Light Source Intensity' para detectar el apagado final.
 * La intensidad = -1 indica dispositivo apagado. Se busca desde el final hacia atrás
 * para encontrar el último bloque continuo de -1 y excluirlo.
 */
export const getLSValidData = (data) => {
  const endIdx = findFinalShutdownIndex(data, 'Light Source Intensity')
  return data.slice(0, endIdx)
}

/**
 * Obtiene el timeline (labels) de un conjunto de datos filtrado
 */
export const getDeviceTimeline = (validData) => {
  return validData.map(row => row['Surgery Time'])
}

// ========== FUNCIONES ORIGINALES ACTUALIZADAS ==========

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
  // Usar datos filtrados de cada dispositivo
  const wadValidData = getWADValidData(data)
  const lsValidData = getLSValidData(data)
  
  // Extraer valores de batería
  const wadBatteryRaw = wadValidData.map(row => row['WAD Battery %'])
  const lsBatteryRaw = lsValidData.map(row => row['Light Source %'])
  
  // Encontrar primer y último índice válido
  const firstValidWadIdx = wadBatteryRaw.findIndex(v => v >= 0)
  const lastValidWadIdx = wadBatteryRaw.findLastIndex(v => v >= 0)
  const firstValidLsIdx = lsBatteryRaw.findIndex(v => v >= 0)
  const lastValidLsIdx = lsBatteryRaw.findLastIndex(v => v >= 0)
  
  // Calcular tiempos reales (cada registro = 10 segundos = 1/6 minuto)
  const wadRealTime = wadValidData.length / 6 // minutos
  const lsRealTime = lsValidData.length / 6 // minutos
  
  // Extraer duraciones estimadas (filtrar valores válidos)
  const wadDuration = wadValidData.map(row => row['WAD Duration (min)']).filter(v => v != null && v > 0)
  const lsDuration = lsValidData.map(row => row['Light Source Duration (min)']).filter(v => v != null && v > 0)

  // Calcular tiempo hasta que la estimación llega a valores bajos (más robusto)
  const wadTimeToOneMinute = (() => {
    // Buscar el PRIMER punto donde la duración llega a <= 1
    for (let i = 0; i < data.length; i++) {
      const dur = data[i]['WAD Duration (min)']
      const battery = data[i]['WAD Battery %']
      // Solo considerar si el dispositivo está encendido (batería >= 0)
      if (battery >= 0 && dur !== null && dur !== undefined && dur !== -1 && dur <= 1) {
        return i / 6 // minutos
      }
    }
    
    // Si nunca llega a 1, usar la duración total de la cirugía
    return data.length / 6
  })()

  const lsTimeToOneMinute = (() => {
    // Buscar el PRIMER punto donde la duración llega a <= 1
    for (let i = 0; i < data.length; i++) {
      const dur = data[i]['Light Source Duration (min)']
      const battery = data[i]['Light Source %']
      // Solo considerar si el dispositivo está encendido (batería >= 0)
      if (battery >= 0 && dur !== null && dur !== undefined && dur !== -1 && dur <= 1) {
        return i / 6 // minutos
      }
    }
    
    // Si nunca llega a 1, usar la duración total de la cirugía
    return data.length / 6
  })()

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
      timeToOneMinute: wadTimeToOneMinute,
      realDuration: wadRealTime
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
      timeToOneMinute: lsTimeToOneMinute,
      realDuration: lsRealTime
    }
  }
}

// ========== FASE 3: ANÁLISIS DE PRECISIÓN POR DISPOSITIVO ==========

/**
 * Analiza la precisión de estimación del WAD
 * Retorna array con datos solo del WAD
 */
export const analyzeWADAccuracy = (data) => {
  const results = []
  
  if (data.length === 0) return results
  
  // Usar el tiempo ABSOLUTO desde el inicio de TODA la cirugía
  const firstTimeAbsolute = data[0]['Surgery Time']
  const lastTimeAbsolute = data[data.length - 1]['Surgery Time']
  
  // Convertir tiempos HH:MM:SS a minutos
  const parseTimeToMinutes = (timeStr) => {
    const parts = timeStr.split(':')
    const hours = parseInt(parts[0], 10)
    const minutes = parseInt(parts[1], 10)
    const seconds = parseInt(parts[2], 10)
    return hours * 60 + minutes + seconds / 60
  }
  
  const totalTimeMinutes = parseTimeToMinutes(lastTimeAbsolute) - parseTimeToMinutes(firstTimeAbsolute)
  
  // Graficar TODOS los puntos de tiempo, no solo donde hay datos del WAD
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const wadEstimate = row['WAD Duration (min)']
    const wadBattery = row['WAD Battery %']
    
    // Línea diagonal perfecta basada en el progreso (índice)
    const progress = i / (data.length - 1) // 0 a 1
    const actualRemaining = totalTimeMinutes * (1 - progress)
    
    results.push({
      time: row['Surgery Time'],
      estimate: (wadBattery >= 0 && wadEstimate >= 0) ? wadEstimate : null, // null si no hay datos
      actual: actualRemaining, // SIEMPRE presente
      error: (wadBattery >= 0 && wadEstimate >= 0) ? Math.abs(wadEstimate - actualRemaining) : null
    })
  }
  
  return results
}

/**
 * Analiza la precisión de estimación de la LS
 * Retorna array con datos solo de la LS
 */
export const analyzeLSAccuracy = (data) => {
  const results = []
  
  if (data.length === 0) return results
  
  // Usar el tiempo ABSOLUTO desde el inicio de TODA la cirugía
  const firstTimeAbsolute = data[0]['Surgery Time']
  const lastTimeAbsolute = data[data.length - 1]['Surgery Time']
  
  // Convertir tiempos HH:MM:SS a minutos
  const parseTimeToMinutes = (timeStr) => {
    const parts = timeStr.split(':')
    const hours = parseInt(parts[0], 10)
    const minutes = parseInt(parts[1], 10)
    const seconds = parseInt(parts[2], 10)
    return hours * 60 + minutes + seconds / 60
  }
  
  const totalTimeMinutes = parseTimeToMinutes(lastTimeAbsolute) - parseTimeToMinutes(firstTimeAbsolute)
  
  // Graficar TODOS los puntos de tiempo, no solo donde hay datos del LS
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const lsEstimate = row['Light Source Duration (min)']
    const lsBattery = row['Light Source %']
    
    // Línea diagonal perfecta basada en el progreso (índice)
    const progress = i / (data.length - 1) // 0 a 1
    const actualRemaining = totalTimeMinutes * (1 - progress)
    
    results.push({
      time: row['Surgery Time'],
      estimate: (lsBattery >= 0 && lsEstimate >= 0) ? lsEstimate : null, // null si no hay datos
      actual: actualRemaining, // SIEMPRE presente
      error: (lsBattery >= 0 && lsEstimate >= 0) ? Math.abs(lsEstimate - actualRemaining) : null
    })
  }
  
  return results
}

/**
 * DEPRECATED: Mantener por compatibilidad pero retorna datos separados
 * Usar analyzeWADAccuracy y analyzeLSAccuracy en su lugar
 */
export const analyzeDurationAccuracy = (data) => {
  console.warn('analyzeDurationAccuracy is deprecated. Use analyzeWADAccuracy and analyzeLSAccuracy instead.')
  return analyzeWADAccuracy(data)
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

// ========== ANÁLISIS DE MÉTRICAS TÉCNICAS ADB ==========

/**
 * 1. Evolución de Temperatura vs Uso del WAD
 * Retorna temperatura (°C) y batería (%) a lo largo del tiempo
 */
export const analyzeTemperatureVsUsage = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => row['WAD ADB Temp (0.1°C)'] !== -1 && row['WAD Battery %'] !== -1)
    .map(row => ({
      time: row['Surgery Time'],
      temperature: row['WAD ADB Temp (0.1°C)'] / 10, // Convertir de 0.1°C a °C
      battery: row['WAD Battery %']
    }))
}

/**
 * 2. Consumo de Corriente en Tiempo Real del WAD
 * Retorna corriente (mA) y calidad de imagen a lo largo del tiempo
 */
export const analyzeCurrentConsumption = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => row['WAD ADB Current (uA)'] !== -1)
    .map(row => ({
      time: row['Surgery Time'],
      current: Math.abs(row['WAD ADB Current (uA)']) / 1000, // Convertir de μA a mA (valor absoluto)
      quality: row['WAD Quality']
    }))
}

/**
 * 3. Degradación de Voltaje del WAD
 * Retorna voltaje (V) vs batería (%)
 */
export const analyzeVoltageDegradation = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => 
      row['WAD ADB Voltage (uV)'] !== -1 && 
      row['WAD Battery %'] !== -1
    )
    .map(row => ({
      battery: row['WAD Battery %'],
      voltage: row['WAD ADB Voltage (uV)'] / 1000000, // Convertir de μV a V
      time: row['Surgery Time']
    }))
    .sort((a, b) => b.battery - a.battery) // Ordenar de 100% a 0%
}

/**
 * 4. Eficiencia Energética (Potencia Instantánea) del WAD
 * Retorna potencia (mW) = Voltaje × Corriente a lo largo del tiempo
 */
export const analyzePowerConsumption = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => 
      row['WAD ADB Voltage (uV)'] !== -1 && 
      row['WAD ADB Current (uA)'] !== -1
    )
    .map(row => {
      const voltageV = row['WAD ADB Voltage (uV)'] / 1000000 // μV a V
      const currentA = Math.abs(row['WAD ADB Current (uA)']) / 1000000 // μA a A
      const powerW = voltageV * currentA // Watts
      
      return {
        time: row['Surgery Time'],
        power: powerW * 1000 // Convertir a mW para mejor legibilidad
      }
    })
}

/**
 * 5. Correlación Temperatura-Corriente del WAD
 * Retorna puntos de dispersión: corriente (mA) vs temperatura (°C)
 */
export const analyzeTemperatureCurrentCorrelation = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => 
      row['WAD ADB Temp (0.1°C)'] !== -1 && 
      row['WAD ADB Current (uA)'] !== -1
    )
    .map((row, index) => ({
      current: Math.abs(row['WAD ADB Current (uA)']) / 1000, // μA a mA
      temperature: row['WAD ADB Temp (0.1°C)'] / 10, // 0.1°C a °C
      time: row['Surgery Time'],
      progress: (index / wadValidData.length) * 100 // % de progreso para gradiente de color
    }))
}

/**
 * 6. Capacidad Real vs Nominal del WAD
 * Retorna batería reportada (%) vs capacidad ADB (%) a lo largo del tiempo
 */
export const analyzeCapacityComparison = (data) => {
  const wadValidData = getWADValidData(data)
  
  return wadValidData
    .filter(row => 
      row['WAD Battery %'] !== -1 && 
      row['WAD ADB Capacity'] !== -1
    )
    .map(row => ({
      time: row['Surgery Time'],
      reportedBattery: row['WAD Battery %'],
      adbCapacity: row['WAD ADB Capacity']
    }))
}

/**
 * 7. Estado de Salud de la Batería del WAD
 * Retorna timeline de cambios en el estado de salud
 */
export const analyzeBatteryHealth = (data) => {
  const wadValidData = getWADValidData(data)
  const healthChanges = []
  let lastHealth = null
  
  wadValidData.forEach((row, index) => {
    const currentHealth = row['WAD ADB Health']
    
    if (currentHealth !== 'Unknown' && currentHealth !== lastHealth) {
      healthChanges.push({
        time: row['Surgery Time'],
        health: currentHealth,
        index: index
      })
      lastHealth = currentHealth
    }
  })
  
  return {
    changes: healthChanges,
    timeline: wadValidData.map(row => ({
      time: row['Surgery Time'],
      health: row['WAD ADB Health'],
      status: row['WAD ADB Status']
    }))
  }
}

/**
 * 8. Mapa de Calor: Temperatura durante Duración del WAD
 * Retorna datos para crear un mapa de calor de temperatura vs duración de uso
 */
export const analyzeTemperatureHeatmap = (data) => {
  const wadValidData = getWADValidData(data)
  
  const heatmapData = wadValidData
    .filter(row => 
      row['WAD ADB Temp (0.1°C)'] !== -1 && 
      row['WAD Duration (min)'] !== -1
    )
    .map((row, index) => ({
      duration: index / 6, // Tiempo transcurrido en minutos
      temperature: row['WAD ADB Temp (0.1°C)'] / 10, // °C
      count: 1 // Para acumulación en bins
    }))
  
  // Crear bins para el mapa de calor
  const durationBins = 10 // Dividir en 10 segmentos de tiempo
  const tempBins = 10 // Dividir en 10 rangos de temperatura
  
  if (heatmapData.length === 0) {
    return { bins: [], durationRange: [0, 0], tempRange: [0, 0] }
  }
  
  const maxDuration = Math.max(...heatmapData.map(d => d.duration))
  const minTemp = Math.min(...heatmapData.map(d => d.temperature))
  const maxTemp = Math.max(...heatmapData.map(d => d.temperature))
  
  const durationStep = maxDuration / durationBins
  const tempStep = (maxTemp - minTemp) / tempBins
  
  // Inicializar matriz de bins
  const bins = []
  for (let i = 0; i < durationBins; i++) {
    for (let j = 0; j < tempBins; j++) {
      bins.push({
        durationMin: i * durationStep,
        durationMax: (i + 1) * durationStep,
        tempMin: minTemp + j * tempStep,
        tempMax: minTemp + (j + 1) * tempStep,
        count: 0
      })
    }
  }
  
  // Llenar bins con datos
  heatmapData.forEach(point => {
    const durationBin = Math.min(Math.floor(point.duration / durationStep), durationBins - 1)
    const tempBin = Math.min(Math.floor((point.temperature - minTemp) / tempStep), tempBins - 1)
    const binIndex = durationBin * tempBins + tempBin
    
    if (binIndex >= 0 && binIndex < bins.length) {
      bins[binIndex].count++
    }
  })
  
  return {
    bins,
    durationRange: [0, maxDuration],
    tempRange: [minTemp, maxTemp],
    rawData: heatmapData
  }
}
