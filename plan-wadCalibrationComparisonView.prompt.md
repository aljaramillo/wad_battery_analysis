## Plan: Calibracion visual WAD en ComparisonView

Crear una vista de calibracion en ComparisonView para definir el algoritmo cliente antes de implementarlo en la app operativa. La recomendacion es no reutilizar tal cual la grafica individual de precision, sino añadir en la comparativa multi-sesion un grafico especifico de estimacion WAD que combine tres capas conceptuales: referencia real agregada por porcentaje de bateria, banda de activacion del algoritmo y estimacion propia derivada de esa referencia agregada. Asi se calibra el criterio con varias cirugias a la vez y no contra una sola sesion, que seria mas fragil y menos defendible.

**Steps**
1. Fase 1. Definir el modelo de datos de calibracion en `c:\code\apolo\battery_analysis_app\src\utils\dataProcessor.js`. Crear funciones puras nuevas para extraer, por sesion, una serie WAD con `time`, `batteryPct`, `vendorEstimateMin`, `actualRemainingMin`, `elapsedSampleIndex` y `elapsedPct`. Esta fase depende de reutilizar `getWADValidData` y el patron de `analyzeWADAccuracy`.
2. Fase 1.1. Añadir una funcion de agregacion multi-sesion en `c:\code\apolo\battery_analysis_app\src\utils\dataProcessor.js` que bucketice por porcentaje de bateria y calcule una referencia agregada de `actualRemainingMin` entre sesiones seleccionadas. La base acordada para la primera iteracion sera la media por bucket de porcentaje. Esta fase puede implementarse en paralelo con el paso 1 siempre que se acuerde el shape comun.
3. Fase 1.2. Diseñar desde el inicio el shape de salida para soportar no solo la media sino tambien dispersion futura por bucket, por ejemplo `sampleCount`, `min`, `max`, `stdDev` o percentiles. Aunque la primera UI use solo la media, esta instrumentacion evita rehacer el pipeline cuando se quiera endurecer la banda de activacion.
4. Fase 2. Definir la logica de activacion experimental en `c:\code\apolo\battery_analysis_app\src\utils\dataProcessor.js`. Para cada punto de una sesion comparada, proyectar la referencia agregada por porcentaje y calcular una banda de tolerancia expresada en minutos alrededor de esa referencia real agregada. Marcar `shouldActivateOwnEstimate` cuando la estimacion vendor quede fuera de la banda. Esta fase depende de 1 y 2.
5. Fase 2.1. Recomendar que la banda no nazca como un valor fijo duro en minutos, sino como una estrategia configurable con una implementacion inicial simple: `media agregada +/- tolerancia fija`. Dejar preparado el codigo para una evolucion a `media +/- dispersion observada` sin cambiar la UI principal. Esta decision mejora la calibracion y es mas robusta que dibujar un solo umbral arbitrario.
6. Fase 2.2. Definir la estimacion propia experimental como la referencia agregada por porcentaje de bateria para cada punto de la sesion. En esta iteracion no hace falta mezclar suavizado temporal ni histeresis; el objetivo es validar visualmente si la referencia agregada serviria como fallback defendible. Esta fase depende de 2.
7. Fase 3. Incorporar una nueva seccion de calibracion en `c:\code\apolo\battery_analysis_app\src\components\ComparisonView.jsx` en lugar de alterar la grafica actual de comparacion de bateria. La propuesta es un grafico de lineas especifico para WAD con una sesion foco visible y capas opcionales para: estimacion vendor, tiempo real restante, referencia agregada, limite superior/inferior de activacion y tramos activados. Esta fase depende de 4 y 6.
8. Fase 3.1. Mantener la UX de ComparisonView compatible con multiples sesiones seleccionadas: usar una sesion foco para la lectura detallada y el conjunto completo de sesiones seleccionadas como base estadistica. Si no existe aun selector de foco, usar temporalmente la primera sesion seleccionada y dejar el plan preparado para un control futuro. Esta fase depende de 7.
9. Fase 3.2. Reutilizar la configuracion existente de Chart.js en `c:\code\apolo\battery_analysis_app\src\components\ComparisonView.jsx` y, si aporta claridad, registrar `chartjs-plugin-annotation` tambien en esta vista para dibujar limites o resaltar zonas activadas. Evitar sobrecargar la grafica actual de bateria normalizada, porque mezcla dos problemas distintos: degradacion de bateria y calidad de estimacion temporal.
10. Fase 4. Ajustar la composicion en `c:\code\apolo\battery_analysis_app\src\App.jsx` solo si hace falta exponer una nocion de sesion foco distinta del array `selectedSessionsData`. Si la primera iteracion puede asumir que el foco es la primera sesion seleccionada, no tocar App y encapsular la logica dentro de ComparisonView.
11. Fase 4.1. Añadir ayuda contextual breve en la propia vista experimental explicando que la banda indica donde el algoritmo cliente sustituiria la estimacion vendor y que la curva propia es una referencia agregada basada en porcentaje. Reutilizar el patron de `ChartTooltip` para no introducir una UX nueva.
12. Fase 5. Verificar la calibracion con las sesiones ya cargables en la app. Validar visualmente que, en arranque temprano, el vendor suele salirse de la banda y que la referencia agregada converge mejor hacia la duracion real. Confirmar tambien que en la fase estable el algoritmo no activaria sustituciones innecesarias. Esta fase depende de todo lo anterior.

**Relevant files**
- `c:\code\apolo\battery_analysis_app\src\components\ComparisonView.jsx` — vista multi-sesion donde encaja mejor la calibracion experimental; hoy ya normaliza sesiones y calcula comparativas entre WADs.
- `c:\code\apolo\battery_analysis_app\src\utils\dataProcessor.js` — lugar natural para extraer series por sesion, agregar por porcentaje y calcular banda de activacion y estimacion propia.
- `c:\code\apolo\battery_analysis_app\src\components\StatisticsPanel.jsx` — referencia del grafico actual de precision WAD y del uso de `react-chartjs-2` para series temporales comparadas.
- `c:\code\apolo\battery_analysis_app\src\App.jsx` — orquestacion de `selectedSessionsData`; solo tocar si se quiere introducir una sesion foco explicita.
- `c:\code\apolo\battery_analysis_app\src\components\ChartTooltip.jsx` — patron de ayuda contextual reutilizable para explicar la vista experimental.

**Verification**
1. Cargar al menos 3 sesiones con comportamientos distintos y comprobar que ComparisonView construye una referencia agregada estable por porcentaje sin romper la grafica actual.
2. Verificar que la nueva serie agregada usa solo datos WAD validos y que el mapeo por porcentaje no incluye el bloque final apagado ya excluido por `getWADValidData`.
3. Confirmar, para una sesion foco, que los puntos marcados como activacion coinciden con desajustes visibles entre estimacion vendor y duracion real restante.
4. Comparar manualmente varios porcentajes clave, por ejemplo 80, 50, 30 y 10, para asegurar que la estimacion propia dibujada corresponde a la media real agregada entre sesiones seleccionadas.
5. Validar que la UI sigue siendo legible en desktop y movil: la grafica nueva no debe saturar leyenda, tooltip ni ejes.
6. Revisar rendimiento al cambiar seleccion de sesiones; si el calculo agregado crece demasiado, dejar identificado el punto para memoizacion adicional o worker futuro.

**Decisions**
- Incluido: la primera iteracion vive en ComparisonView, no en StatisticsPanel.
- Incluido: la estimacion propia inicial se basa en la media de duracion real restante agregada por porcentaje de bateria entre sesiones seleccionadas.
- Incluido: el criterio visual de activacion se representa como una banda de tolerancia en minutos alrededor de la referencia agregada.
- Incluido: la vista es experimental y de calibracion, no la implementacion final del algoritmo runtime.
- Excluido: histeresis, suavizado temporal y estados de confianza dentro de esta misma iteracion visual.
- Excluido: automatismos productivos en la app del otro repositorio; aqui solo se valida la regla con datos historicos.
- Recomendacion tecnica: preparar el agregado con soporte futuro para dispersion, porque una banda basada solo en un umbral fijo sera menos defendible que una banda derivada de variabilidad observada.

**Further Considerations**
1. Si la lectura principal debe ser mas clara, separar la vista en dos graficos hermanos dentro de ComparisonView: uno de contexto multi-sesion y otro de calibracion de la sesion foco. Recomiendo esta opcion si la leyenda empieza a crecer demasiado.
2. Si algunas sesiones arrancan con bateria inicial muy distinta, considerar normalizar o filtrar buckets con pocas muestras antes de interpretar la media como referencia valida.
3. Si despues de validar visualmente la media resulta fragil, el siguiente paso natural no seria cambiar de vista sino pasar a mediana o banda por percentiles sobre el mismo pipeline.