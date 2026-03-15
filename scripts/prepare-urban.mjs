#!/usr/bin/env node
/**
 * prepare-urban.mjs
 * Urban licenses and POT constraints for Comuna 11 (Laureles-Estadio).
 * Uses REAL data from:
 *   - licencias_urbanisticas.csv (32,266 rows — filtered to ~1,406 for Laureles Estadio)
 *   - lotes_potenciales_desarrollo.csv (441,966 rows — ~26,259 for Comuna 11)
 *   - capacidad_soporte_barrio_medata.csv (331,740 rows — ~21,660 for Comuna 11)
 *   - pot-viability-complete.geojson (22 features — POT viability zones)
 */
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

// ── Source paths ──
const SRC_LICENCIAS =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/licencias_urbanisticas.csv";
const SRC_LOTES =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/lotes_potenciales_desarrollo.csv";
const SRC_CAPACIDAD =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/capacidad_soporte_barrio_medata.csv";
const SRC_POT_GEOJSON =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/geojson/pot-viability-complete.geojson";

// ── Approximate centroids for Laureles-Estadio barrios (IGAC/OpenStreetMap) ──
const BARRIO_COORDS = {
  "Carlos E. Restrepo":   { lat: 6.2520, lon: -75.5740 },
  "Suramericana":         { lat: 6.2610, lon: -75.5855 },
  "Cuarta Brigada":       { lat: 6.2635, lon: -75.5930 },
  "Bolivariana":          { lat: 6.2545, lon: -75.5810 },
  "Los Conquistadores":   { lat: 6.2530, lon: -75.5780 },
  "Laureles":             { lat: 6.2480, lon: -75.5870 },
  "Las Acacias":          { lat: 6.2440, lon: -75.5910 },
  "La Castellana":        { lat: 6.2500, lon: -75.5950 },
  "Los Colores":          { lat: 6.2590, lon: -75.5920 },
  "San Joaquín":          { lat: 6.2520, lon: -75.5780 },
  "El Velódromo":         { lat: 6.2560, lon: -75.5880 },
  "Estadio":              { lat: 6.2558, lon: -75.5890 },
  "El Estadio":           { lat: 6.2558, lon: -75.5890 },
  "Florida Nueva":        { lat: 6.2460, lon: -75.5850 },
  "Lorena":               { lat: 6.2430, lon: -75.5820 },
  "Naranjal":             { lat: 6.2490, lon: -75.5760 },
  "U.P.B.":               { lat: 6.2540, lon: -75.5900 },
  "U.P.B":                { lat: 6.2540, lon: -75.5900 },
  "U.D. Atanasio Girardot": { lat: 6.2555, lon: -75.5895 },
  "Batallón Cuarta Brigada": { lat: 6.2630, lon: -75.5940 },
};
const DEFAULT_COORD = { lat: 6.2510, lon: -75.5870 };

/**
 * Simple CSV line parser that handles quoted fields with commas.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Stream-read a large CSV, filter rows, and return matching objects.
 */
async function streamCSV(path, filterFn, maxRows = Infinity) {
  const rl = createInterface({ input: createReadStream(path, "utf-8"), crlfDelay: Infinity });
  let headers = null;
  const results = [];
  let totalRead = 0;

  for await (const line of rl) {
    if (!headers) {
      headers = parseCSVLine(line);
      continue;
    }
    totalRead++;
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i] || ""));
    if (filterFn(obj)) {
      results.push(obj);
      if (results.length >= maxRows) break;
    }
  }
  return { results, totalRead, headers };
}

/**
 * Normalize uso_edificacion to a clean category.
 */
function normalizeUso(raw) {
  const u = (raw || "").toUpperCase().trim();
  if (!u) return "Sin dato";
  if (u.includes("RESIDENCIAL") && (u.includes("COMERCIAL") || u.includes("MIXTO") || u.includes("MIXTA")))
    return "Mixto (Residencial-Comercial)";
  if (u.includes("MIXTO") || u.includes("MIXTA")) return "Mixto";
  if (u.includes("RESIDENCIAL") || u.includes("VIVIENDA") || u === "REDIDENCIAL")
    return "Residencial";
  if (u.includes("COMERCI") || u.includes("COMERCIO")) return "Comercial";
  if (u.includes("SERVICIO") || u.includes("OFICINA")) return "Servicios";
  if (u.includes("DOTACIONAL") || u.includes("EQUIPAMIENTO") || u.includes("EQUIPAMENTO") || u.includes("INSTITUCIONAL"))
    return "Dotacional";
  if (u.includes("HOTEL") || u.includes("ALOJAMIENTO") || u.includes("HOSPEDAJE"))
    return "Alojamiento";
  if (u.includes("BAJA MIXTURA")) return "Baja Mixtura";
  if (u.includes("MEDIA MIXTURA")) return "Media Mixtura";
  if (u.includes("ALTA MIXTURA")) return "Alta Mixtura";
  return "Otro";
}

/**
 * Extract main construction type from objeto field.
 */
function extractObjeto(raw) {
  const o = (raw || "").trim();
  const parts = o.split(";").map((p) => p.trim().replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const mainTypes = ["Obra nueva", "Construcción", "Ampliación", "Modificación", "Demolición",
    "Reconocimiento", "Reforzamiento estructural", "Cerramiento", "Adecuación",
    "Legalización", "Reconstrucción", "Urbanización", "Demolición parcial", "Demolición total"];
  const found = [];
  for (const p of parts) {
    for (const t of mainTypes) {
      if (p.toLowerCase().includes(t.toLowerCase()) && !found.includes(t)) {
        found.push(t);
      }
    }
  }
  return found.length > 0 ? found.join("; ") : (parts[0] || "Otro");
}

/**
 * Normalize clase_vivienda to a clean category.
 */
function normalizeClase(raw) {
  const c = (raw || "").toUpperCase().trim();
  if (!c) return "Sin dato";
  if (c.includes("MULTI")) return "Multifamiliar";
  if (c.includes("BI") || c.includes("TRI")) return "Bifamiliar/Trifamiliar";
  if (c.includes("UNI") || c.includes("UNFA")) return "Unifamiliar";
  if (c.includes("MIXTO") || c.includes("MIXTA")) return "Mixto";
  if (c.includes("COMERCI")) return "Comercial";
  if (c.includes("HOTEL") || c.includes("ALOJ") || c.includes("HOSP")) return "Alojamiento";
  return c.substring(0, 30);
}

/**
 * Jitter coordinates slightly so markers don't overlap on map.
 */
function jitter(coord, rng) {
  return {
    lat: coord.lat + (rng() - 0.5) * 0.004,
    lon: coord.lon + (rng() - 0.5) * 0.004,
  };
}

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

/**
 * Parse Colombian decimal format: "1.241.04" or "277,762915129151" → number
 */
function parseColNumber(raw) {
  if (!raw) return null;
  const s = raw.trim();
  // If has comma as decimal separator (e.g., "53,4163")
  if (s.includes(",") && !s.includes(".")) {
    return parseFloat(s.replace(",", "."));
  }
  // If has both dots and commas, comma is decimal
  if (s.includes(",")) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  // Plain number
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export default async function prepareUrban() {
  const rng = seededRandom(42);

  // ═══════════════════════════════════════════════════════════════
  // 1. URBAN LICENSES — from licencias_urbanisticas.csv
  // ═══════════════════════════════════════════════════════════════
  console.log("  [urban] Reading licencias_urbanisticas.csv...");
  const { results: rawLic, totalRead: totalLic } = await streamCSV(
    SRC_LICENCIAS,
    (row) => (row.comuna || "").toLowerCase().includes("laureles"),
  );
  console.log(`  [urban] Scanned ${totalLic.toLocaleString()} rows, found ${rawLic.length} for Laureles Estadio`);

  const licenses = rawLic.map((row, i) => {
    const barrio = (row.barrio || "").trim();
    const coord = jitter(BARRIO_COORDS[barrio] || DEFAULT_COORD, rng);
    const areaRaw = row.area || "";
    const areaParsed = parseColNumber(areaRaw);

    return {
      id: row.id || `LIC-${i + 1}`,
      radicado: row.radicado || "",
      año: row["año_radicado_principal"] || row["año_resolucion_principal"] || "",
      curaduria: row.curaduria || "",
      tipo_licencia: row.tipo_licencia || "",
      objeto: extractObjeto(row.objeto),
      objeto_raw: row.objeto || "",
      direccion: row.direccion_licencia || "",
      comuna: "11 - Laureles Estadio",
      barrio,
      uso_edificacion: normalizeUso(row.uso_edificacion),
      uso_raw: row.uso_edificacion || "",
      edificacion_pot: row.edificacion_pot || "",
      area_m2: areaParsed,
      clase_vivienda: normalizeClase(row.clase_vivienda),
      fecha_inicial: row.fecha_inicial || "",
      fecha_final: row.fecha_final || "",
      lat: Math.round(coord.lat * 1e6) / 1e6,
      lon: Math.round(coord.lon * 1e6) / 1e6,
      source: "medata-licencias-urbanisticas",
    };
  });

  // Summary stats
  const byBarrio = {};
  const byUso = {};
  const byTipo = {};
  const byYear = {};
  for (const lic of licenses) {
    byBarrio[lic.barrio] = (byBarrio[lic.barrio] || 0) + 1;
    byUso[lic.uso_edificacion] = (byUso[lic.uso_edificacion] || 0) + 1;
    byTipo[lic.tipo_licencia] = (byTipo[lic.tipo_licencia] || 0) + 1;
    byYear[lic.año] = (byYear[lic.año] || 0) + 1;
  }
  console.log(`  [urban] Licenses by barrio:`, JSON.stringify(byBarrio));
  console.log(`  [urban] Licenses by uso:`, JSON.stringify(byUso));

  // ═══════════════════════════════════════════════════════════════
  // 2. LOTES POTENCIALES — summarized by barrio from CSV
  // ═══════════════════════════════════════════════════════════════
  console.log("  [urban] Reading lotes_potenciales_desarrollo.csv (streaming)...");
  const lotesStats = {};
  const { totalRead: totalLotes } = await streamCSV(
    SRC_LOTES,
    (row) => {
      if (row.Cod_Com?.trim() !== "11") return false;
      const barrio = (row.Nom_Barrio || "").trim();
      const anio = (row.Anio || "").trim();
      const potenc = (row.Potenc || "").trim();
      const ttof = (row.TTOF || "").trim();
      if (!lotesStats[barrio]) {
        lotesStats[barrio] = { total: 0, potencial: 0, area_bruta: 0, area_neta: 0, tratamientos: new Set(), years: new Set() };
      }
      lotesStats[barrio].total++;
      lotesStats[barrio].years.add(anio);
      lotesStats[barrio].tratamientos.add(ttof);
      if (potenc === "SI") {
        lotesStats[barrio].potencial++;
        const ab = parseFloat((row.AreaBruta || "0").replace(",", "."));
        const an = parseFloat((row.AreaNeta || "0").replace(",", "."));
        if (!isNaN(ab)) lotesStats[barrio].area_bruta += ab;
        if (!isNaN(an)) lotesStats[barrio].area_neta += an;
      }
      return false; // Don't collect rows, just stats
    },
  );
  console.log(`  [urban] Scanned ${totalLotes.toLocaleString()} lotes rows`);

  // ═══════════════════════════════════════════════════════════════
  // 3. CAPACIDAD DE SOPORTE — key indicators per barrio (2020)
  // ═══════════════════════════════════════════════════════════════
  console.log("  [urban] Reading capacidad_soporte_barrio_medata.csv (streaming)...");
  const KEY_INDICATORS = [
    "Densidad de la norma básica",
    "Densidad habitacional",
    "Densidad poblacional",
    "Índice de Capacidad de Soporte",
    "Índice de capacidad funcional",
    "Altura norma básica",
    "Índice de construcción norma básica",
    "Suelo potencial de desarrollo",
    "Viviendas totales",
    "Población total",
  ];
  const capacidadData = {};
  const { totalRead: totalCap } = await streamCSV(
    SRC_CAPACIDAD,
    (row) => {
      if (row.Cod_Com?.trim() !== "11") return false;
      if (row.Anio?.trim() !== "2020") return false;
      const ind = (row.Nom_Ind || "").trim();
      if (!KEY_INDICATORS.includes(ind)) return false;
      const barrio = (row.Nom_Barrio || "").trim();
      if (!capacidadData[barrio]) capacidadData[barrio] = {};
      capacidadData[barrio][ind] = parseColNumber(row.Valor);
      return false;
    },
  );
  console.log(`  [urban] Scanned ${totalCap.toLocaleString()} capacidad rows`);

  // ═══════════════════════════════════════════════════════════════
  // 4. POT VIABILITY GEOJSON — real zones
  // ═══════════════════════════════════════════════════════════════
  console.log("  [urban] Reading pot-viability-complete.geojson...");
  const potRaw = JSON.parse(readFileSync(SRC_POT_GEOJSON, "utf-8"));
  console.log(`  [urban] Loaded ${potRaw.features.length} viability features`);

  // Build POT constraints per barrio with real data
  const barrioConstraints = [];
  const barrioNames = Object.keys(BARRIO_COORDS);
  for (const barrio of barrioNames) {
    const cap = capacidadData[barrio] || {};
    const lotes = lotesStats[barrio] || { total: 0, potencial: 0, area_bruta: 0, area_neta: 0, tratamientos: new Set() };
    const coord = BARRIO_COORDS[barrio];

    barrioConstraints.push({
      barrio,
      comuna: "11 - Laureles Estadio",
      lat: coord.lat,
      lon: coord.lon,
      // Capacidad de soporte (2020)
      densidad_norma_basica_viv_ha: cap["Densidad de la norma básica"] ?? null,
      densidad_habitacional_viv_ha: cap["Densidad habitacional"] ?? null,
      densidad_poblacional_hab_ha: cap["Densidad poblacional"] ?? null,
      indice_capacidad_soporte: cap["Índice de Capacidad de Soporte"] ?? null,
      indice_capacidad_funcional: cap["Índice de capacidad funcional"] ?? null,
      altura_norma_basica: cap["Altura norma básica"] ?? null,
      indice_construccion_norma: cap["Índice de construcción norma básica"] ?? null,
      suelo_potencial_m2: cap["Suelo potencial de desarrollo"] ?? null,
      viviendas_totales: cap["Viviendas totales"] ?? null,
      poblacion_total: cap["Población total"] ?? null,
      // Lotes potenciales
      lotes_total: lotes.total,
      lotes_potenciales: lotes.potencial,
      lotes_area_bruta_m2: Math.round(lotes.area_bruta),
      lotes_area_neta_m2: Math.round(lotes.area_neta),
      tratamientos_pot: [...(lotes.tratamientos || [])],
      // License counts
      licencias_count: byBarrio[barrio] || 0,
    });
  }

  const potConstraints = {
    type: "FeatureCollection",
    metadata: {
      source: "medata-capacidad-soporte-2020 + lotes-potenciales + pot-viability",
      generated: new Date().toISOString(),
      area: "Comuna 11 - Laureles Estadio",
      description: "Real POT constraint data per barrio: capacity indices, density norms, development lots, and urban licenses",
      indicators_year: 2020,
    },
    barrio_constraints: barrioConstraints,
    features: potRaw.features,
  };

  // ═══════════════════════════════════════════════════════════════
  // 5. WRITE OUTPUT
  // ═══════════════════════════════════════════════════════════════
  writeFileSync(resolve(OUT, "urban-licenses.json"), JSON.stringify(licenses, null, 0));
  writeFileSync(resolve(OUT, "pot-constraints.json"), JSON.stringify(potConstraints, null, 0));

  console.log(`  [urban] Wrote urban-licenses.json (${licenses.length} licenses)`);
  console.log(`  [urban] Wrote pot-constraints.json (${barrioConstraints.length} barrio constraints + ${potRaw.features.length} POT viability features)`);
  console.log(`  [urban] Summary: ${Object.keys(lotesStats).length} barrios with lotes data, ${Object.keys(capacidadData).length} barrios with capacity data`);
}

if (process.argv[1] && process.argv[1].endsWith("prepare-urban.mjs")) {
  prepareUrban().catch(console.error);
}
