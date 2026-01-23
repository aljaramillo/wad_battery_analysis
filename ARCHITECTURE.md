# Arquitectura de la Aplicación

## 📐 Diseño General

La aplicación sigue una arquitectura de **Single Page Application (SPA)** con React, organizada en capas lógicas:

```
┌─────────────────────────────────────────┐
│         Interfaz de Usuario             │
│  (Componentes React + CSS)              │
├─────────────────────────────────────────┤
│         Lógica de Aplicación            │
│  (Estado, Props, Hooks)                 │
├─────────────────────────────────────────┤
│       Procesamiento de Datos            │
│  (Utils: Parser + Processor)            │
├─────────────────────────────────────────┤
│          Visualización                   │
│  (Chart.js)                             │
└─────────────────────────────────────────┘
```

## 🔄 Flujo de Datos

### 1. Carga de Archivos
```
Usuario arrastra CSV
    ↓
FileUploader captura evento
    ↓
Papaparse parsea CSV
    ↓
csvParser extrae metadatos
    ↓
Estado global (sessions) se actualiza
    ↓
UI se re-renderiza
```

### 2. Procesamiento y Visualización
```
Usuario selecciona sesiones
    ↓
selectedSessions se actualiza
    ↓
dataProcessor transforma datos
    ↓
Chart.js renderiza gráficos
    ↓
Componentes muestran estadísticas
```

## 🧩 Componentes Principales

### App.jsx (Orquestador)
- **Responsabilidad**: Gestión del estado global
- **Estado**:
  - `sessions`: Array de sesiones cargadas
  - `selectedSessions`: Índices de sesiones seleccionadas
- **Funciones**:
  - `handleFilesLoaded`: Agrega nuevas sesiones
  - `handleSessionToggle`: Selecciona/deselecciona sesiones
  - `handleRemoveSession`: Elimina una sesión

### FileUploader (Entrada de Datos)
- **Responsabilidad**: Carga de archivos
- **Eventos**:
  - Drag & drop
  - Click para seleccionar
- **Output**: Array de sesiones parseadas

### BatteryChart (Visualización Simple)
- **Input**: Una sesión
- **Output**: Gráfico de línea con WAD y Light Source
- **Sampling**: Cada 6 puntos (1 minuto) para optimizar

### ComparisonView (Visualización Comparativa)
- **Input**: Múltiples sesiones
- **Output**: Gráficos comparativos + tabla
- **Normalización**: Escala de 0-100% del tiempo total

### SummaryCards (Métricas)
- **Input**: Sesión actual
- **Output**: Tarjetas con KPIs
- **Métricas**:
  - Duración total
  - Consumo de WAD
  - Consumo de Light Source
  - Total de mediciones

### StatisticsPanel (Análisis Profundo)
- **Input**: Una sesión
- **Output**: Estadísticas + gráficos de precisión
- **Análisis**:
  - Consumo promedio
  - Rango de estimaciones
  - Error de estimación

## 📊 Estructura de Datos

### Sesión Completa
```javascript
{
  id: "123456789",
  data: [
    {
      "Surgery Time": "00:00:10",
      "Timestamp": "2026-01-21T17:41:59.652Z",
      "WAD Battery %": 99,
      "WAD Duration (min)": 0,
      "WAD Quality": "1080p 60fps",
      "Light Source %": 99,
      "Light Source Duration (min)": 0,
      "Light Source Intensity": 5
    },
    // ... más filas
  ],
  summary: {
    surgeryDate: "21/1/2026",
    duration: 252,
    wadSerialNumber: "WAD-AA-0000",
    wadInitial: 99,
    wadFinal: 1,
    wadDrop: 98,
    wadAvgConsumption: 0.389,
    // ... más campos
  },
  fileName: "battery-debug_123456789_2026-01-21T21-53-44.csv"
}
```

## 🔧 Utilidades

### csvParser.js
```javascript
parseCSV(file)              // File → Array de objetos
parseSummaryText(text)      // String → Objeto de resumen
```

### dataProcessor.js
```javascript
processChartData(data)           // Extrae arrays para Chart.js
calculateStatistics(data)        // Calcula métricas
analyzeDurationAccuracy(data)    // Analiza precisión
getColorForSession(index)        // Colores para gráficos
```

## 🎨 Sistema de Estilos

### Enfoque: CSS Modular
- Cada componente tiene su `.css` asociado
- Clases semánticas (`.battery-chart`, `.summary-card`)
- Variables consistentes (sin CSS variables, valores directos)
- Responsive design con media queries

### Paleta de Colores
```css
Principal: #667eea (Púrpura)
Secundario: #f093fb (Rosa)
Acento 1: #4facfe (Azul)
Acento 2: #43e97b (Verde)
Texto: #2c3e50
Gris: #7f8c8d
Background: #f5f7fa
```

## 🚀 Optimizaciones

### 1. Sampling de Datos
- Gráficos muestran 1 de cada 6 puntos (1 minuto)
- Reduce carga de renderizado
- Mantiene precisión visual

### 2. React.StrictMode
- Detecta problemas en desarrollo
- Preparado para Concurrent Mode

### 3. Chart.js Configuration
- `pointRadius: 0` - Sin puntos individuales
- `pointHoverRadius: 5` - Puntos en hover
- `tension: 0.4` - Curvas suaves

### 4. Componentes Funcionales
- Hooks (useState, useRef)
- Sin clase components
- Performance optimizada

## 📱 Responsive Design

### Breakpoints
```css
Mobile: < 768px  (1 columna)
Tablet: 768px+   (2 columnas)
Desktop: 1024px+ (grid completo)
```

### Adaptaciones
- Gráficos apilados en mobile
- Grid responsivo automático
- Touch-friendly (drag & drop)

## 🔐 Consideraciones de Seguridad

- ✅ Sin backend - datos locales
- ✅ No se envían datos a servidores
- ✅ Procesamiento en navegador
- ✅ Sin cookies ni tracking

## 🧪 Testing (Futuro)

### Casos de Test Sugeridos
```javascript
// Parsing
- CSV válido se parsea correctamente
- CSV inválido muestra error
- Summary TXT se parsea correctamente

// Visualización
- Gráficos se renderizan con datos
- Comparación muestra múltiples sesiones
- Colores son únicos por sesión

// Interacción
- Drag & drop funciona
- Selección/deselección funciona
- Eliminación de sesión funciona
```

## 📈 Mejoras Futuras

1. **Export de Reportes**
   - PDF con gráficos
   - CSV con estadísticas
   - Imágenes de gráficos

2. **Análisis Avanzado**
   - Machine Learning para predicciones
   - Detección de anomalías
   - Recomendaciones automáticas

3. **Filtros**
   - Por rango de fechas
   - Por serial number
   - Por duración

4. **Persistencia**
   - LocalStorage para sesiones
   - IndexedDB para grandes datasets
   - Import/Export de sesiones

5. **Colaboración**
   - Compartir análisis vía URL
   - Anotaciones en gráficos
   - Reportes colaborativos

---

**Fecha**: Enero 2026  
**Versión**: 1.0.0
