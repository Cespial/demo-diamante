# Diagnóstico: Transcripción vs Estado Actual del Demo

> Fecha: 2026-03-25
> Cada item de la transcripción se marca: HECHO / PARCIAL / PENDIENTE

---

## A. TRÁFICO Y MOVILIDAD

| # | Pedido en transcripción | Estado | Detalle |
|---|------------------------|--------|---------|
| A1 | "Toda la malla vial, no solo corredores seleccionados" | **HECHO** | 703 segmentos OSM con clasificación POT (51 arterias, 145 colectoras, 50 locales principales) |
| A2 | "Desde San Juan hasta La Iguana, incluyendo la 33" | **HECHO** | Calle 33, San Juan, La Iguana incluidos en malla vial |
| A3 | "Tráfico promedio por día, no solo por hora" | **HECHO** | TPD en TrafficTab: 68,787 veh/día (normal) con diferencial evento |
| A4 | "Diferencia entre día normal y día evento muy evidente" | **HECHO** | KPIs "TPD Normal" vs "TPD [Escenario]" con delta |
| A5 | "Velocidad debe variar por escenario (congestión)" | **HECHO** | Ya implementado en scenario-engine + ahora datos reales SIMM (552 perfiles) |
| A6 | "Los 9,000 de autos y motos, revisar el supuesto" | **HECHO** | Reemplazado con datos oficiales SIMM. Composición: 51% autos, 38% motos |
| A7 | "Acotar los vehículos al polígono" | **HECHO** | Polígono Cra 68–77C × Cll 45–53A definido y renderizado |
| A8 | "Polígono seleccionable (botón 100%, 80%)" | **PENDIENTE** | Polígono está fijo; falta toggle interactivo en UI |
| A9 | "Número de vehículos por hora en el polígono" | **HECHO** | 14 intersecciones con perfil horario, datos SIMM |
| A10 | "¿A qué horas empiezan los clásicos? 4:30-5PM" | **HECHO** | peakHour del clásico ajustado de 15 → 17 |

## B. ORÍGENES Y DESTINOS

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| B1 | "¿De dónde vienen? ¿A dónde van?" | **HECHO** | OD con destino explícito "→ Polígono Diamante" |
| B2 | "Volumen por origen (Bello, La Estrella, etc.)" | **HECHO** | 10 orígenes con % distribución y volumen estimado |
| B3 | "Orígenes y destinos: destino al polígono" | **HECHO** | Tooltip en TrafficTab muestra "Destino: Polígono Diamante" |

## C. DEMANDA VS OFERTA

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| C1 | "1,100 es la oferta nuestra, no la demanda" | **HECHO** | Modelo reescrito: demanda = tráfico × atracción; oferta = competencia + Diamante |
| C2 | "Demanda total es otra cosa, separar" | **HECHO** | getParkingDemand() ahora independiente de totalSpaces |
| C3 | "Factor de atracción parametrizable" | **PARCIAL** | ATTRACTION_FACTOR_DEFAULT = 0.02 en config; falta slider en UI |
| C4 | "Oferta = mapeo de todos los parqueaderos" | **HECHO** | 20 parqueaderos como polígonos + tooltip con celdas |
| C5 | "Oferta competidora más la del Diamante" | **HECHO** | Gráfico muestra dos líneas: oferta total (verde) + solo Diamante (azul) |
| C6 | "Sumar las celdas totales para comparar" | **HECHO** | Total oferta = competencia (701) + Diamante (1,100) = 1,801 |
| C7 | "La cifra de competencia no la confío, revisar" | **PARCIAL** | Datos Cali Mayor parciales integrados; falta validación campo |
| C8 | "Obelisco no sale como parqueadero en Maps" | **PENDIENTE** | Obelisco sigue sin aparecer como parking (es "centro comercial" en Google) |
| C9 | "Ustedes tienen cifra de celdas, pasármela" | **PARCIAL** | Cali Mayor reportó 4 POIs (276 celdas); resto pendiente |

## D. PERSONAS Y PEATONES

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| D1 | "Necesitamos número de personas, no índice" | **PARCIAL** | Estimación via ratio demanda/oferta por manzana; falta número absoluto |
| D2 | "Flujo peatonal sobre el polígono específicamente" | **PARCIAL** | Pedestrian intensity grid existe pero es índice, no absoluto |
| D3 | "Ligas: natación, patinaje, tenis — como usuarios base" | **HECHO** | Liga nocturna con 500 personas en escenarios |
| D4 | "Metro: datos de la línea B (estación Estadio)" | **HECHO** | metro-ridership.json con Estadio + Suramericana (2011-2020) |

## E. MODELO FINANCIERO

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| E1 | "Quitar cifras que son puro supuesto del resumen" | **HECHO** | ExecutiveTab limpio: sin payback/ROI/ingresos netos |
| E2 | "Eventos al año y demanda vehicular sí son reales" | **HECHO** | 52 eventos, 68,787 veh/día (SIMM) |
| E3 | "52 fechas especiales, un domingo" | **HECHO** | eventsPerYear = 52 |
| E4 | "Tarifa plena $35,000/día" | **HECHO** | Modelo financiero: $35K/día para 52 eventos |
| E5 | "Obelisco $27,000/día como referencia" | **HECHO** | Mostrado en ExecutiveTab y ParkingTab |
| E6 | "1,100 celdas × 50% × 5,000 la hora × 14 horas" | **HECHO** | Base 45% (alineado) × $5K/hr × 14hrs × 313 días |
| E7 | "El racional financiero solo necesita datos reales" | **HECHO** | Modelo usa aforos SIMM + oferta inventariada |

## F. MAPA Y VISUALIZACIÓN

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| F1 | "Pintar el proyecto (muñequito en el mapa)" | **HECHO** | Marcador dorado ◆ con tooltip "1,100 celdas, 2 sótanos" |
| F2 | "Agregar todas las leyendas/convenciones" | **HECHO** | Leyenda dinámica: velocidad, polígonos, POIs, OD, malla vial |
| F3 | "Los parqueaderos no confiables, revisar cifra" | **PARCIAL** | Polígonos con capacidad estimada + badge fuente |
| F4 | "Motos vs carros en cada parqueadero" | **PENDIENTE** | No diferenciado aún |
| F5 | "Dimensión celda: 2.40-2.50m × 5.50m" | **HECHO** | En PREFACTIBILIDAD_DIAMANTE: 2.50 × 5.50 |
| F6 | "Circulación: 5-7.5m pasillo" | **HECHO** | Documentado en prefactibilidad |
| F7 | "Isocronas alineadas con Cali Mayor" | **PARCIAL** | Isocronas existen (5/10/15 min); falta overlay Cali Mayor |
| F8 | "Foto de satélite para contar carros" | **PENDIENTE** | Requiere Google Earth / Esri manual |

## G. DOCUMENTO DE FACTIBILIDAD

| # | Pedido | Estado | Detalle |
|---|--------|--------|---------|
| G1 | "Documento de factibilidad según Decreto 438" | **HECHO** | PREFACTIBILIDAD_DIAMANTE.docx (462 líneas, 8 capítulos) |
| G2 | "Art. 6 requisitos mínimos de prefactibilidad" | **HECHO** | Todos los items del Art. 2.2.2.1.5.2 cubiertos |
| G3 | "Art. 9 requisitos de factibilidad" | **PARCIAL** | Prefactibilidad completa; factibilidad requiere campo |

---

## RESUMEN DE SCORE

| Categoría | Hecho | Parcial | Pendiente | Total |
|-----------|-------|---------|-----------|-------|
| Tráfico y Movilidad | 9 | 0 | 1 | 10 |
| Orígenes y Destinos | 3 | 0 | 0 | 3 |
| Demanda vs Oferta | 5 | 3 | 1 | 9 |
| Personas y Peatones | 2 | 2 | 0 | 4 |
| Modelo Financiero | 7 | 0 | 0 | 7 |
| Mapa y Visualización | 3 | 2 | 3 | 8 |
| Documento Factibilidad | 2 | 1 | 0 | 3 |
| **TOTAL** | **31** | **8** | **5** | **44** |

**Score: 31/44 completados (70%), 8 parciales (18%), 5 pendientes (12%)**

---

## BACKLOG DE GAPS RESTANTES

### Sprint Inmediato (hoy)

| ID | Gap | Dificultad | Tiempo |
|----|-----|-----------|--------|
| **G-A8** | Polígono seleccionable (toggle en UI) | Media | 2 hrs |
| **G-C3** | Slider de factor de atracción en ParkingTab | Fácil | 30 min |
| **G-F4** | Diferenciación motos/carros en parqueaderos | Media | 1 hr |

### Sprint siguiente (esta semana)

| ID | Gap | Dificultad | Tiempo |
|----|-----|-----------|--------|
| **G-C8** | Agregar Obelisco manualmente como parqueadero | Fácil | 15 min |
| **G-C9** | Integrar datos Cali Mayor cuando lleguen | Fácil | 1 hr |
| **G-D1** | Número absoluto de peatones (BestTime.app o conteo) | Alta | 3 hrs |
| **G-D2** | Flujo peatonal absoluto por polígono | Alta | 3 hrs |
| **G-F7** | Overlay isocronas de Cali Mayor | Media | 1 hr |

### Sprint futuro (requiere trabajo de campo)

| ID | Gap | Dependencia |
|----|-----|------------|
| **G-F8** | Foto satelital conteo de carros | Google Earth manual |
| **G-C7** | Validación de celdas con campo | Cali Mayor |
| **G-G3** | Estudio de factibilidad completo (Art. 9) | Campo + ingeniería + legal |
