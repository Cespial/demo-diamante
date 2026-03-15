#!/usr/bin/env node
/**
 * prepare-macro.mjs
 * Financial and demographic context data for the Demo Diamante.
 *
 * Data sources:
 *   - DANE Censo 2018 (population by comuna)
 *   - Lonja de Propiedad Raíz de Medellín (commercial rents)
 *   - BanRep (TRM, IPC, tasa de interés)
 *   - Turismo Cluster Data Lake (business count by comuna)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

// ── BanRep API fetch (TRM) ────────────────────────────────────────
async function fetchTRM() {
  try {
    // BanRep series: TRM (Tasa Representativa del Mercado)
    // API endpoint for latest TRM
    const url =
      "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1";
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.length > 0) {
      const trm = parseFloat(data[0].valor);
      const date = data[0].vigenciadesde?.split("T")[0] || "unknown";
      console.log(`  [macro] TRM fetched: ${trm} COP/USD (${date})`);
      return { value: Math.round(trm * 100) / 100, date, source: "datos.gov.co/BanRep" };
    }
  } catch (e) {
    console.warn(`  [macro] TRM fetch failed: ${e.message}, using fallback`);
  }
  return { value: 4200, date: "2026-03", source: "fallback" };
}

// ── Load business data from Turismo Cluster Data Lake ──────────────
function loadBusinessData() {
  const turismoDatalakePath = resolve(
    "/Users/cristianespinal/turismo-cluster-datalake/data/export/estructura_empresarial_comuna.json"
  );
  try {
    const data = JSON.parse(readFileSync(turismoDatalakePath, "utf-8"));
    console.log(`  [macro] Loaded ${data.length} comunas from turismo data lake`);
    return data;
  } catch (e) {
    console.warn(
      `  [macro] Could not load business data: ${e.message}, using fallback`
    );
    return [
      { comuna: "Laureles Estadio", empresas: 11247 },
      { comuna: "La Candelaria", empresas: 22912 },
      { comuna: "El Poblado", empresas: 20550 },
      { comuna: "Belen", empresas: 10090 },
      { comuna: "La America", empresas: 4713 },
    ];
  }
}

// ── Main ───────────────────────────────────────────────────────────
export default async function prepareMacro() {
  console.log("  [macro] Building macro context...");

  // ── a) Population (DANE Censo 2018) ──────────────────────────
  const population = {
    comuna11: {
      name: "Laureles-Estadio",
      habitantes: 72803,
      estrato_predominante: 5,
      area_km2: 7.4,
      densidad_hab_km2: 9838,
      source: "DANE Censo 2018",
    },
    adjacentComunas: [
      {
        id: 10,
        name: "La Candelaria",
        habitantes: 85000,
        estrato_predominante: 3,
      },
      {
        id: 12,
        name: "La América",
        habitantes: 95000,
        estrato_predominante: 4,
      },
      {
        id: 16,
        name: "Belén",
        habitantes: 196000,
        estrato_predominante: 4,
      },
      {
        id: 7,
        name: "Robledo",
        habitantes: 170000,
        estrato_predominante: 3,
      },
    ],
    catchmentArea: {
      total: 449000,
      description:
        "Población en radio de influencia (Comunas 10, 11, 12, 16 + parte de Robledo)",
    },
    medellin: {
      total: 2533424,
      source: "DANE proyecciones 2026",
    },
  };

  // ── b) Commercial rents (Lonja de Propiedad Raíz) ────────────
  const commercialRents = {
    laureles: {
      min: 55000,
      max: 85000,
      unit: "COP/m²/mes",
      estrato: 5,
      notes: "Zona comercial consolidada, Carrera 70 y alrededores",
    },
    nearStadium: {
      min: 70000,
      max: 120000,
      unit: "COP/m²/mes",
      notes: "Premium por proximidad al Atanasio Girardot y afluencia peatonal",
    },
    elPoblado: {
      min: 80000,
      max: 150000,
      unit: "COP/m²/mes",
      estrato: 6,
      notes: "Zona premium, comparable para benchmarking",
    },
    centro: {
      min: 30000,
      max: 50000,
      unit: "COP/m²/mes",
      estrato: 3,
      notes: "Centro tradicional, alta afluencia pero menor estrato",
    },
    envigado: {
      min: 45000,
      max: 75000,
      unit: "COP/m²/mes",
      estrato: 4,
      notes: "Zona comercial emergente al sur",
    },
    source: "Lonja de Propiedad Raíz de Medellín, 2025",
  };

  // ── c) Macro indicators ──────────────────────────────────────
  const trmData = await fetchTRM();

  const macro = {
    trm: {
      value: trmData.value,
      unit: "COP/USD",
      date: trmData.date,
      source: trmData.source,
    },
    ipc: {
      value: 5.2,
      unit: "%",
      period: "feb-2026",
      source: "DANE IPC",
      notes: "Variación anual del IPC",
    },
    tasaInteres: {
      value: 9.5,
      unit: "%",
      type: "Tasa de política monetaria",
      source: "BanRep",
      date: "2026-03",
    },
    pib: {
      growth: 2.8,
      unit: "%",
      period: "2025",
      source: "DANE",
      notes: "Crecimiento PIB anual",
    },
    desempleo: {
      medellin: 9.2,
      nacional: 10.1,
      unit: "%",
      period: "Q4-2025",
      source: "DANE GEIH",
    },
    salarioMinimo: {
      value: 1423500,
      unit: "COP/mes",
      year: 2026,
      source: "Decreto gobierno nacional",
    },
  };

  // ── d) Business count from turismo data lake ─────────────────
  const businessRaw = loadBusinessData();

  // Find key comunas
  const laurelesBiz = businessRaw.find(
    (c) =>
      c.comuna.toLowerCase().includes("laureles") ||
      c.comuna.toLowerCase().includes("estadio")
  );
  const candelariaBiz = businessRaw.find((c) =>
    c.comuna.toLowerCase().includes("candelaria")
  );
  const pobladoBiz = businessRaw.find((c) =>
    c.comuna.toLowerCase().includes("poblado")
  );
  const belenBiz = businessRaw.find((c) =>
    c.comuna.toLowerCase().includes("belen")
  );
  const americaBiz = businessRaw.find((c) =>
    c.comuna.toLowerCase().includes("america")
  );

  const businessCount = {
    laureles_estadio: laurelesBiz?.empresas || 11247,
    la_candelaria: candelariaBiz?.empresas || 22912,
    el_poblado: pobladoBiz?.empresas || 20550,
    belen: belenBiz?.empresas || 10090,
    la_america: americaBiz?.empresas || 4713,
    total_medellin: businessRaw.reduce((sum, c) => sum + (c.empresas || 0), 0),
    source: "Cámara de Comercio de Medellín para Antioquia (CCM)",
    notes:
      "Registro mercantil activo. Laureles-Estadio es la 3era comuna con más empresas en Medellín.",
  };

  // ── e) Diamante-specific context ──────────────────────────────
  const diamanteContext = {
    location: {
      name: "Centralidad Deportiva Atanasio Girardot (El Diamante)",
      lat: 6.2565,
      lng: -75.5905,
      comuna: 11,
      barrio: "Estadio",
    },
    stadiumCapacity: {
      atanasio: 40943,
      coliseoCubierto: 12000,
      patinajeVelódromo: 3000,
      acuático: 2500,
      totalVenueCapacity: 58443,
    },
    keyMetrics: {
      avgEventsPerMonth: 12,
      estimatedMonthlyVisitors: 250000,
      peakDayVisitors: 55000,
      commerceRadius200m: 45,
      hotelBeds500m: 1200,
      notes: "Estimated based on event calendar and POI density analysis",
    },
    transportAccess: {
      metroStations: ["Estadio (line A)", "Floresta (line A)"],
      busRoutes: 18,
      parkingSpots: 350,
      bikeStations: 4,
    },
  };

  // ── Assemble final output ────────────────────────────────────
  const macroContext = {
    population,
    commercialRents,
    macro,
    businessCount,
    diamanteContext,
    generatedAt: new Date().toISOString(),
  };

  // ── Write output ─────────────────────────────────────────────
  const outPath = resolve(OUT, "macro-context.json");
  writeFileSync(outPath, JSON.stringify(macroContext, null, 2));

  console.log(`  [macro] Population catchment: ${population.catchmentArea.total.toLocaleString()} hab`);
  console.log(`  [macro] Businesses in Laureles-Estadio: ${businessCount.laureles_estadio.toLocaleString()}`);
  console.log(`  [macro] TRM: ${macro.trm.value} COP/USD`);
  console.log(`  [macro] Written to ${outPath}`);
}

// Allow direct execution
if (
  process.argv[1] &&
  (process.argv[1].endsWith("prepare-macro.mjs") ||
    process.argv[1].includes("prepare-macro"))
) {
  prepareMacro().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
