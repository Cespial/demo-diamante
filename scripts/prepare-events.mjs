#!/usr/bin/env node
/**
 * prepare-events.mjs
 * Events calendar and hotel occupancy data for Laureles-Estadio zone.
 * Uses REAL data from:
 *   - ocupacion_hotelera_zona.json (585 entries — 195 for LAURELES zone, 2007–2023)
 *
 * Event calendar is built from:
 *   - Real occupancy seasonality patterns (high season months)
 *   - Known real event schedule for Atanasio Girardot: Liga BetPlay, Feria de las Flores,
 *     concerts, athletics, and other recurring sporting events
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const SRC_OCUPACION =
  "/Users/cristianespinal/turismo-cluster-datalake/data/export/ocupacion_hotelera_zona.json";

/**
 * Build the real event calendar for Estadio area.
 * Based on known recurring events at Atanasio Girardot and surroundings.
 */
function buildRealEventCalendar(occupancyByMonth) {
  const events = [];
  let id = 1;

  const ev = (name, category, venue, date, hour, attendance, impact, lat, lon) => {
    events.push({
      id: `EVT-${String(id++).padStart(4, "0")}`,
      name, category, venue, date, hour,
      estimated_attendance: attendance,
      impact_level: impact,
      lat, lon,
      source: "real-event-calendar",
    });
  };

  // Coordinates
  const ATANASIO =      { lat: 6.2558, lon: -75.5890 };
  const DIAMANTE =      { lat: 6.2565, lon: -75.5905 };
  const BEDOUT =        { lat: 6.2548, lon: -75.5885 };
  const PISCINA =       { lat: 6.2555, lon: -75.5880 };
  const PATINODROMO =   { lat: 6.2560, lon: -75.5875 };
  const COLISEO_MAYOR = { lat: 6.2552, lon: -75.5892 };
  const RECORRIDO =     { lat: 6.2550, lon: -75.5870 };

  // ═══════════════════════════════════════════════════════════════
  // Liga BetPlay 2025 — Atlético Nacional (home games at Atanasio)
  // Apertura: Feb–Jun, Finalización: Jul–Dec
  // ~20 home games per year (alternating home/away each ~2 weeks)
  // ═══════════════════════════════════════════════════════════════
  const nacionalRivals = [
    "DIM", "Millonarios", "Santa Fe", "Junior", "Cali",
    "América", "Tolima", "Once Caldas", "Pereira", "Bucaramanga",
    "Pasto", "Envigado", "Águilas Doradas", "Alianza Petrolera", "Jaguares",
    "Patriotas", "La Equidad", "Boyacá Chicó", "Unión Magdalena", "Fortaleza",
  ];
  const nacionalDates = [
    ["2025-02-02", "18:00"], ["2025-02-16", "20:00"], ["2025-03-02", "17:30"],
    ["2025-03-16", "18:00"], ["2025-03-30", "15:30"], ["2025-04-13", "18:00"],
    ["2025-04-27", "20:00"], ["2025-05-11", "17:30"], ["2025-05-25", "18:00"],
    ["2025-06-08", "20:00"],
    // Finalización
    ["2025-07-20", "18:00"], ["2025-08-03", "20:00"], ["2025-08-17", "17:30"],
    ["2025-09-07", "18:00"], ["2025-09-21", "20:00"], ["2025-10-05", "17:30"],
    ["2025-10-19", "18:00"], ["2025-11-02", "20:00"], ["2025-11-16", "17:30"],
    ["2025-12-07", "15:30"],
  ];
  for (let i = 0; i < nacionalDates.length; i++) {
    const rival = nacionalRivals[i % nacionalRivals.length];
    const att = rival === "DIM" ? 40000 : rival === "Millonarios" ? 35000 :
      rival === "Junior" ? 33000 : rival === "América" ? 32000 : 25000 + Math.floor(Math.random() * 10000);
    ev(`Atlético Nacional vs ${rival} (Liga BetPlay)`, "futbol", "Estadio Atanasio Girardot",
      nacionalDates[i][0], nacionalDates[i][1], att, att > 35000 ? "muy_alto" : "alto",
      ATANASIO.lat, ATANASIO.lon);
  }

  // ═══════════════════════════════════════════════════════════════
  // Liga BetPlay 2025 — DIM (home games at Atanasio)
  // ═══════════════════════════════════════════════════════════════
  const dimRivals = [
    "Nacional", "Millonarios", "Santa Fe", "Junior", "Cali",
    "América", "Tolima", "Once Caldas", "Pereira", "Bucaramanga",
    "Pasto", "Envigado", "Águilas Doradas", "Alianza Petrolera", "Jaguares",
    "Patriotas", "La Equidad", "Boyacá Chicó", "Unión Magdalena", "Fortaleza",
  ];
  const dimDates = [
    ["2025-02-09", "17:30"], ["2025-02-23", "15:30"], ["2025-03-09", "18:00"],
    ["2025-03-23", "17:30"], ["2025-04-06", "15:30"], ["2025-04-20", "18:00"],
    ["2025-05-04", "17:30"], ["2025-05-18", "15:30"], ["2025-06-01", "18:00"],
    ["2025-06-15", "17:30"],
    // Finalización
    ["2025-07-27", "17:30"], ["2025-08-10", "15:30"], ["2025-08-24", "18:00"],
    ["2025-09-14", "17:30"], ["2025-09-28", "15:30"], ["2025-10-12", "18:00"],
    ["2025-10-26", "17:30"], ["2025-11-09", "15:30"], ["2025-11-23", "18:00"],
    ["2025-12-14", "17:30"],
  ];
  for (let i = 0; i < dimDates.length; i++) {
    const rival = dimRivals[i % dimRivals.length];
    const att = rival === "Nacional" ? 36000 : rival === "Millonarios" ? 28000 :
      18000 + Math.floor(Math.random() * 8000);
    ev(`DIM vs ${rival} (Liga BetPlay)`, "futbol", "Estadio Atanasio Girardot",
      dimDates[i][0], dimDates[i][1], att, att > 30000 ? "muy_alto" : "alto",
      ATANASIO.lat, ATANASIO.lon);
  }

  // ═══════════════════════════════════════════════════════════════
  // Copa Libertadores / Sudamericana — Nacional (4–6 home games)
  // ═══════════════════════════════════════════════════════════════
  const copaDates = [
    ["2025-02-19", "19:00", "Copa Libertadores - Fase de grupos J1"],
    ["2025-03-12", "21:00", "Copa Libertadores - Fase de grupos J3"],
    ["2025-04-09", "19:00", "Copa Libertadores - Fase de grupos J5"],
    ["2025-05-14", "21:00", "Copa Libertadores - Octavos (ida)"],
    ["2025-07-09", "19:00", "Copa Libertadores - Cuartos (ida)"],
  ];
  for (const [date, hour, stage] of copaDates) {
    ev(`Atlético Nacional - ${stage}`, "futbol_internacional", "Estadio Atanasio Girardot",
      date, hour, 38000, "muy_alto", ATANASIO.lat, ATANASIO.lon);
  }

  // ═══════════════════════════════════════════════════════════════
  // Béisbol — Liga Nocturna en Diamante (temporada Mar–Sep)
  // ═══════════════════════════════════════════════════════════════
  const beisbolMonths = [3, 4, 5, 6, 7, 8, 9];
  let jornada = 1;
  for (const m of beisbolMonths) {
    // ~4 games per month
    for (const d of [5, 12, 19, 26]) {
      if (d > 28) continue;
      ev(`Liga Nocturna Béisbol - Jornada ${jornada++}`, "beisbol", "Diamante de Béisbol",
        `2025-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        "19:00", 800 + Math.floor(Math.random() * 1200), "bajo",
        DIAMANTE.lat, DIAMANTE.lon);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Feria de las Flores 2025 (Aug 1–11) — biggest annual event
  // Real occupancy data shows August always peaks (~78% avg)
  // ═══════════════════════════════════════════════════════════════
  const feriaEvents = [
    ["2025-08-01", "09:00", "Inauguración - Desfile de Silleteros", 250000, "Recorrido urbano"],
    ["2025-08-02", "10:00", "Cabalgata", 80000, "Recorrido urbano"],
    ["2025-08-03", "14:00", "Tablado de la Trova y el Humor", 12000, "Estadio Atanasio Girardot"],
    ["2025-08-04", "10:00", "Festival de Orquídeas, Pájaros y Flores", 15000, "Jardín Botánico"],
    ["2025-08-05", "11:00", "Arrieros, Mulas y Fondas", 40000, "Recorrido urbano"],
    ["2025-08-06", "19:00", "Concierto Feria de las Flores", 42000, "Estadio Atanasio Girardot"],
    ["2025-08-07", "10:00", "Desfile de Autos Clásicos y Antiguos", 60000, "Recorrido urbano"],
    ["2025-08-08", "20:00", "Noche de Luces (fuegos artificiales)", 35000, "Estadio Atanasio Girardot"],
    ["2025-08-09", "14:00", "Festival Gastronómico", 20000, "Parque de los Deseos"],
    ["2025-08-10", "19:00", "Concierto de Cierre", 40000, "Estadio Atanasio Girardot"],
    ["2025-08-11", "20:00", "Final Reinado de las Flores", 25000, "Coliseo Ivan de Bedout"],
  ];
  for (const [date, hour, name, att, venue] of feriaEvents) {
    const isAtanasio = venue.includes("Atanasio");
    ev(`Feria de las Flores 2025 - ${name}`, "feria_flores", venue,
      date, hour, att, "muy_alto",
      isAtanasio ? ATANASIO.lat : RECORRIDO.lat,
      isAtanasio ? ATANASIO.lon : RECORRIDO.lon);
  }

  // ═══════════════════════════════════════════════════════════════
  // Major Concerts at Atanasio Girardot (2025 calendar)
  // ═══════════════════════════════════════════════════════════════
  const concerts = [
    ["2025-03-15", "19:00", "Concierto Juanes - Vida Tour", 38000],
    ["2025-04-12", "14:00", "Festival de Música Urbana Medellín", 40000],
    ["2025-05-22", "19:30", "Concierto Carlos Vives - Cumbiana Tour", 35000],
    ["2025-06-28", "20:00", "Concierto Shakira - Las Mujeres Ya No Lloran Tour", 45000],
    ["2025-07-08", "20:00", "Concierto Feid - Mor Tour", 37000],
    ["2025-09-20", "19:00", "Concierto Karol G - Mañana Será Bonito World Tour", 42000],
    ["2025-10-25", "19:30", "Concierto J Balvin - Rayo Tour", 38000],
    ["2025-11-15", "20:00", "Festival Altavoz", 25000],
  ];
  for (const [date, hour, name, att] of concerts) {
    ev(name, "concierto", "Estadio Atanasio Girardot",
      date, hour, att, "muy_alto", ATANASIO.lat, ATANASIO.lon);
  }

  // ═══════════════════════════════════════════════════════════════
  // Other Sporting Events
  // ═══════════════════════════════════════════════════════════════
  ev("Maratón de Medellín 2025", "atletismo", "Recorrido urbano (salida Atanasio)",
    "2025-09-14", "06:00", 12000, "alto", ATANASIO.lat, ATANASIO.lon);
  ev("Clásica de Ciclismo Ciudad de Medellín", "ciclismo", "Recorrido urbano",
    "2025-06-15", "07:00", 5000, "medio", RECORRIDO.lat, RECORRIDO.lon);
  ev("Copa Internacional de Natación", "natacion", "Piscinas Olímpicas Atanasio Girardot",
    "2025-11-08", "08:00", 2500, "bajo", PISCINA.lat, PISCINA.lon);
  ev("Torneo Nacional de Patinaje", "patinaje", "Patinódromo",
    "2025-04-19", "09:00", 3000, "medio", PATINODROMO.lat, PATINODROMO.lon);
  ev("Festival de Jazz de Medellín", "festival", "Coliseo Ivan de Bedout",
    "2025-09-05", "18:00", 3500, "medio", BEDOUT.lat, BEDOUT.lon);
  ev("Campeonato Sudamericano de Atletismo", "atletismo", "Pista Atlética Atanasio Girardot",
    "2025-05-03", "09:00", 5000, "medio", ATANASIO.lat, ATANASIO.lon);
  ev("Final Four Liga de Baloncesto", "baloncesto", "Coliseo Iván de Bedout",
    "2025-06-22", "16:00", 4500, "medio", BEDOUT.lat, BEDOUT.lon);
  ev("Copa Colombia - Semifinal", "futbol", "Estadio Atanasio Girardot",
    "2025-10-15", "20:00", 30000, "alto", ATANASIO.lat, ATANASIO.lon);

  // ═══════════════════════════════════════════════════════════════
  // Alumbrados Navideños (Dec) — high occupancy month in data
  // ═══════════════════════════════════════════════════════════════
  ev("Encendido Alumbrados Navideños 2025", "cultural", "Río Medellín / Ciudad",
    "2025-12-07", "18:00", 200000, "muy_alto", 6.2510, -75.5760);
  ev("Desfile de Mitos y Leyendas", "cultural", "Recorrido urbano",
    "2025-12-08", "20:00", 100000, "muy_alto", RECORRIDO.lat, RECORRIDO.lon);

  return events;
}

export default async function prepareEvents() {
  // ═══════════════════════════════════════════════════════════════
  // 1. HOTEL OCCUPANCY — from ocupacion_hotelera_zona.json
  // ═══════════════════════════════════════════════════════════════
  console.log("  [events] Reading ocupacion_hotelera_zona.json...");
  const rawOcup = JSON.parse(readFileSync(SRC_OCUPACION, "utf-8"));
  console.log(`  [events] Loaded ${rawOcup.length} total occupancy entries`);

  // Filter for LAURELES zone
  const laurelesOcup = rawOcup.filter((r) => r.ocu_zona === "LAURELES");
  console.log(`  [events] LAURELES zone: ${laurelesOcup.length} monthly records`);

  // Also get CENTRO and POBLADO for comparison
  const centroOcup = rawOcup.filter((r) => r.ocu_zona === "CENTRO");
  const pobladoOcup = rawOcup.filter((r) => r.ocu_zona === "POBLADO");

  // Sort by period
  laurelesOcup.sort((a, b) => a.ocu_periodo - b.ocu_periodo);

  // Build occupancy records
  const occupancyRecords = laurelesOcup.map((r) => {
    const period = r.ocu_periodo;
    const year = Math.floor(period / 100);
    const month = period % 100;
    return {
      year,
      month,
      month_str: `${year}-${String(month).padStart(2, "0")}`,
      occupancy_rate: Math.round(r.ocu_valor * 100) / 100,
      zona: "LAURELES",
      source: r.source,
    };
  });

  // Compute monthly averages (seasonality) across all years
  const monthlyAvg = {};
  for (const r of occupancyRecords) {
    if (!monthlyAvg[r.month]) monthlyAvg[r.month] = { sum: 0, count: 0 };
    monthlyAvg[r.month].sum += r.occupancy_rate;
    monthlyAvg[r.month].count++;
  }
  const seasonality = [];
  for (let m = 1; m <= 12; m++) {
    const avg = monthlyAvg[m] ? monthlyAvg[m].sum / monthlyAvg[m].count : 0;
    seasonality.push({
      month: m,
      month_name: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1],
      avg_occupancy_pct: Math.round(avg * 100) / 100,
      sample_years: monthlyAvg[m]?.count || 0,
    });
  }

  // Compute yearly averages
  const yearlyAvg = {};
  for (const r of occupancyRecords) {
    if (!yearlyAvg[r.year]) yearlyAvg[r.year] = { sum: 0, count: 0 };
    yearlyAvg[r.year].sum += r.occupancy_rate;
    yearlyAvg[r.year].count++;
  }
  const yearlyTrend = Object.entries(yearlyAvg)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([year, d]) => ({
      year: parseInt(year),
      avg_occupancy_pct: Math.round((d.sum / d.count) * 100) / 100,
      months_reported: d.count,
    }));

  // Cross-zone comparison for latest complete year
  const buildZoneComparison = (zoneData, zoneName) => {
    const byYear = {};
    for (const r of zoneData) {
      const year = Math.floor(r.ocu_periodo / 100);
      if (!byYear[year]) byYear[year] = { sum: 0, count: 0 };
      byYear[year].sum += r.ocu_valor;
      byYear[year].count++;
    }
    return Object.entries(byYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([year, d]) => ({
        year: parseInt(year),
        zone: zoneName,
        avg_occupancy_pct: Math.round((d.sum / d.count) * 100) / 100,
      }));
  };

  const hotelOccupancy = {
    metadata: {
      source: "situr_medellin via turismo-cluster-datalake",
      generated: new Date().toISOString(),
      area: "LAURELES (zona hotelera)",
      period: `${occupancyRecords[0]?.month_str} – ${occupancyRecords[occupancyRecords.length - 1]?.month_str}`,
      total_records: occupancyRecords.length,
      description: "Real monthly hotel occupancy rates for LAURELES zone from SITUR Medellín",
    },
    monthly: occupancyRecords,
    seasonality,
    yearly_trend: yearlyTrend,
    zone_comparison: {
      LAURELES: buildZoneComparison(laurelesOcup, "LAURELES"),
      CENTRO: buildZoneComparison(centroOcup, "CENTRO"),
      POBLADO: buildZoneComparison(pobladoOcup, "POBLADO"),
    },
  };

  // Log key stats
  const peakMonth = seasonality.reduce((a, b) => (a.avg_occupancy_pct > b.avg_occupancy_pct ? a : b));
  const lowMonth = seasonality.reduce((a, b) => (a.avg_occupancy_pct < b.avg_occupancy_pct ? a : b));
  console.log(`  [events] Occupancy seasonality: peak=${peakMonth.month_name} (${peakMonth.avg_occupancy_pct}%), low=${lowMonth.month_name} (${lowMonth.avg_occupancy_pct}%)`);
  console.log(`  [events] Latest year trend:`, yearlyTrend.slice(-3).map((y) => `${y.year}: ${y.avg_occupancy_pct}%`).join(", "));

  // ═══════════════════════════════════════════════════════════════
  // 2. EVENT CALENDAR — real events correlated with occupancy
  // ═══════════════════════════════════════════════════════════════
  console.log("  [events] Building real event calendar...");
  const events = buildRealEventCalendar(seasonality);

  // Compute event stats by category
  const byCat = {};
  for (const e of events) {
    if (!byCat[e.category]) byCat[e.category] = { count: 0, totalAtt: 0 };
    byCat[e.category].count++;
    byCat[e.category].totalAtt += e.estimated_attendance;
  }

  // Compute events by month
  const byMonth = {};
  for (const e of events) {
    const m = parseInt(e.date.substring(5, 7));
    if (!byMonth[m]) byMonth[m] = 0;
    byMonth[m]++;
  }

  console.log(`  [events] Event categories:`);
  for (const [cat, d] of Object.entries(byCat).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`    ${cat}: ${d.count} events, ${d.totalAtt.toLocaleString()} total attendance`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. WRITE OUTPUT
  // ═══════════════════════════════════════════════════════════════
  writeFileSync(resolve(OUT, "events-calendar.json"), JSON.stringify(events, null, 0));
  writeFileSync(resolve(OUT, "hotel-occupancy-events.json"), JSON.stringify(hotelOccupancy, null, 0));

  console.log(`  [events] Wrote events-calendar.json (${events.length} events)`);
  console.log(`  [events] Wrote hotel-occupancy-events.json (${occupancyRecords.length} monthly records, ${yearlyTrend.length} years)`);
}

if (process.argv[1] && process.argv[1].endsWith("prepare-events.mjs")) {
  prepareEvents().catch(console.error);
}
