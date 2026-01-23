# 📊 Battery Analysis App

Aplicación web para visualizar y comparar el comportamiento de baterías WAD y Light Source durante cirugías.

## 🚀 Características

- ✅ Carga de archivos CSV con datos de batería
- ✅ Visualización de gráficos en tiempo real
- ✅ Comparación de múltiples sesiones de cirugía
- ✅ Análisis estadístico detallado
- ✅ Evaluación de precisión de estimaciones de duración
- ✅ Interfaz intuitiva con drag & drop
- ✅ 100% en el navegador (sin backend)

## 🛠️ Tecnologías Utilizadas

- **React** - Framework UI
- **Vite** - Build tool ultra rápido
- **Chart.js** - Librería de visualización de datos
- **Papaparse** - Parser de CSV
- **CSS** - Estilos personalizados

## 📦 Instalación

### Prerrequisitos

- Node.js v18+ instalado
- npm o yarn

### Pasos

1. Instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo:
```bash
npm run dev
```

3. Abre tu navegador en `http://localhost:5173`

## 📋 Uso

### 1. Cargar Archivos

Arrastra y suelta archivos CSV (y opcionalmente TXT) en el área de carga, o haz clic para seleccionarlos.

**Formato esperado:**
- `battery-debug_XXXXXXX_YYYY-MM-DDTHH-MM-SS.csv` - Datos detallados
- `battery-summary_XXXXXXX_YYYY-MM-DDTHH-MM-SS.txt` - Resumen (opcional)

### 2. Seleccionar Sesiones

Marca las sesiones que deseas visualizar. Puedes:
- Ver una sesión individual con análisis detallado
- Comparar múltiples sesiones lado a lado

### 3. Analizar Datos

La aplicación muestra automáticamente:
- **Tarjetas de resumen** - Métricas clave de la sesión
- **Gráficos de batería** - Nivel de carga vs tiempo
- **Estadísticas** - Consumo promedio, estimaciones, etc.
- **Análisis de precisión** - Comparación entre estimaciones y realidad

## 📊 Estructura de Datos CSV

El CSV debe contener las siguientes columnas:

```csv
Surgery Time,Timestamp,WAD Battery %,WAD Duration (min),WAD Quality,Light Source %,Light Source Duration (min),Light Source Intensity
00:00:10,2026-01-21T17:41:59.652Z,99,0,1080p 60fps,99,0,5
```

## 🔧 Comandos Disponibles

```bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Compila para producción
npm run preview  # Preview de producción local
```

## 📁 Estructura del Proyecto

```
battery_analysis_app/
├── src/
│   ├── components/           # Componentes React
│   │   ├── FileUploader.jsx     # Cargador de archivos
│   │   ├── BatteryChart.jsx     # Gráfico principal
│   │   ├── ComparisonView.jsx   # Vista de comparación
│   │   ├── SummaryCards.jsx     # Tarjetas de resumen
│   │   └── StatisticsPanel.jsx  # Panel estadístico
│   ├── utils/                # Utilidades
│   │   ├── csvParser.js         # Parser de CSV
│   │   └── dataProcessor.js     # Procesamiento de datos
│   ├── App.jsx               # Componente principal
│   ├── App.css              # Estilos de App
│   ├── main.jsx             # Entry point
│   └── index.css            # Estilos globales
├── index.html               # HTML principal
├── vite.config.js          # Configuración de Vite
└── package.json            # Dependencias
```

## 🎯 Casos de Uso

### Análisis Individual
- Visualiza el comportamiento de batería en una cirugía específica
- Revisa estadísticas detalladas de consumo
- Evalúa la precisión de las estimaciones de duración

### Comparación de Sesiones
- Compara múltiples cirugías simultáneamente
- Identifica patrones de consumo
- Analiza diferencias en comportamiento

### Estrategia de Batería
- Determina patrones de consumo típicos
- Evalúa fiabilidad de estimaciones
- Planifica mejoras en gestión de energía

## 🚢 Deployment

### Build de Producción

```bash
npm run build
```

Los archivos optimizados estarán en `dist/`.

### Opciones de Hosting

- **Vercel**: `vercel deploy`
- **Netlify**: Arrastra la carpeta `dist/`
- **GitHub Pages**: Configura workflow de GitHub Actions

## 📝 Notas

- La aplicación funciona completamente en el navegador
- No requiere backend ni base de datos
- Los archivos se procesan localmente
- Soporta navegadores modernos (Chrome, Firefox, Edge, Safari)

## 🤝 Contribuir

Las mejoras son bienvenidas. Para cambios mayores:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

ISC

---

Creado con ❤️ para mejorar el análisis de baterías en cirugías
