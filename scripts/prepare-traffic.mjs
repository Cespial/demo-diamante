#!/usr/bin/env node
/**
 * prepare-traffic.mjs
 * Generates traffic corridor and aforo data for Comuna 11 (Laureles-Estadio)
 * using REAL data from HPTU vehicular counts and Google Routes speed data.
 *
 * Sources:
 *  - aforos_vehiculares.csv  (74,900 rows — 15-min vehicle counts by intersection)
 *  - velocidad_tiempo_viaje_gt.csv (682,503 rows — Google Routes speed by corridor/hour)
 *  - Overpass API for real road network geometries
 *
 * Outputs:
 *  - public/data/traffic-corridors.json  → TrafficCorridor[]
 *  - public/data/traffic-aforos.json     → TrafficAforo[]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

// ── Source paths ──
const SRC_AFOROS =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/aforos_vehiculares.csv";
const SRC_VELOCITY =
  "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/velocidad_tiempo_viaje_gt.csv";

// ── Laureles-Estadio bounding box (for Overpass) ──
const CENTER_LAT = 6.2565;
const CENTER_LNG = -75.5905;

// ── CSV column indices (0-based) from header analysis ──
// Aforos: NODO(0), VÍA_PRINCIPAL(2), VÍA_SECUNDARIA(3), AUTOS(7), BUSES(8),
//         CAMIONES(9), MOTOS(10), BICICLETAS(11), COORDENADAX(14), COORDENADAY(15),
//         INTERSECCIÓN(22), HORA(25), AUTOS_HORA(27), BUSES_HORA(28), CAMIONES_HORA(29),
//         MOTOS_HORA(30), BICICLETAS_HORA(31), VOLUMEN_TOTAL_HORA(32),
//         COMUNA(37), CODIGO(38), NOMBRE_COMUNA(39)
//
// Velocity: HORA(7), NOMBRE_CORREDOR(9), SENTIDO(11), INICIO(12), FIN(13),
//           VELOCIDAD_KM/H(16)

// ── Parse CSV robustly (handles quoted fields with commas) ──
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function readCSV(path) {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] || "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}

// ── Corridor definitions: map corridor names from velocity CSV to Laureles-area roads ──
// These are the corridors that pass through or border Comuna 11
const CORRIDOR_DEFS = [
  {
    id: "av80",
    name: "Avenida 80 (N-S)",
    velocityCorredor: "Avenida 80",
    overpassName: "Avenida 80",
    fallbackCoords: [
      [-75.5967, 6.2700],
      [-75.5967, 6.2635],
      [-75.5967, 6.2580],
      [-75.5975, 6.2500],
      [-75.6001, 6.2426],
      [-75.6030, 6.2387],
    ],
  },
  {
    id: "av33",
    name: "Avenida 33 / Calle 33 (E-W)",
    velocityCorredor: "Avenida 33",
    overpassName: "Avenida 33",
    overpassAliases: ["Calle 33", "Avenida 33"],
    fallbackCoords: [
      [-75.5875, 6.2393],
      [-75.5899, 6.2393],
      [-75.5967, 6.2390],
      [-75.5984, 6.2389],
      [-75.6030, 6.2387],
      [-75.6085, 6.2384],
    ],
  },
  {
    id: "avsanjuan",
    name: "Av. San Juan / Calle 44 (E-W)",
    velocityCorredor: "Avenida San Juan",
    overpassName: "Calle 44",
    fallbackCoords: [
      [-75.5810, 6.2500],
      [-75.5870, 6.2496],
      [-75.5923, 6.2496],
      [-75.5935, 6.2497],
      [-75.5969, 6.2501],
      [-75.5997, 6.2501],
    ],
  },
  {
    id: "calle30",
    name: "Calle 30 / Circular 1 (E-W)",
    velocityCorredor: "Calle 30",
    overpassName: "Circular 1",
    fallbackCoords: [
      [-75.5810, 6.2446],
      [-75.5860, 6.2446],
      [-75.5894, 6.2446],
      [-75.5923, 6.2456],
      [-75.5960, 6.2460],
    ],
  },
  {
    id: "cra70",
    name: "Carrera 70 (N-S)",
    velocityCorredor: null, // no direct velocity data; infer from aforos
    overpassName: "Carrera 70",
    fallbackCoords: [
      [-75.5851, 6.2605],
      [-75.5859, 6.2590],
      [-75.5875, 6.2540],
      [-75.5880, 6.2510],
      [-75.5894, 6.2446],
    ],
  },
  {
    id: "cra65",
    name: "Carrera 65 (N-S)",
    velocityCorredor: null,
    overpassName: "Carrera 65",
    fallbackCoords: [
      [-75.5800, 6.2595],
      [-75.5808, 6.2566],
      [-75.5810, 6.2561],
      [-75.5813, 6.2556],
    ],
  },
  {
    id: "tv39b",
    name: "Transversal 39B (N-S)",
    velocityCorredor: null,
    overpassName: "Transversal 39B",
    fallbackCoords: [
      [-75.5938, 6.2435],
      [-75.5960, 6.2460],
      [-75.5960, 6.2480],
      [-75.5978, 6.2479],
      [-75.5997, 6.2501],
    ],
  },
  {
    id: "cra76",
    name: "Carrera 76 (N-S)",
    velocityCorredor: null,
    overpassName: "Carrera 76",
    overpassAliases: ["Carrera 76", "Carrera 76A"],
    fallbackCoords: [
      [-75.5915, 6.2604],
      [-75.5952, 6.2504],
      [-75.5967, 6.2465],
      [-75.5967, 6.2390],
    ],
  },
  {
    id: "calle49b",
    name: "Calle 49B / Av. Bolivariana (E-W)",
    velocityCorredor: null,
    overpassName: "Calle 49B",
    overpassAliases: ["Calle 49B", "Calle 49", "Avenida Bolivariana"],
    fallbackCoords: [
      [-75.5813, 6.2556],
      [-75.5904, 6.2600],
      [-75.5910, 6.2602],
      [-75.5935, 6.2614],
      [-75.5950, 6.2621],
      [-75.5956, 6.2624],
      [-75.5961, 6.2626],
    ],
  },
  {
    id: "circ4",
    name: "Circular 4 / Circular 73 (Loop)",
    velocityCorredor: null,
    overpassName: "Circular 4",
    overpassAliases: ["Circular 4", "Circular 73", "Circular 4."],
    fallbackCoords: [
      [-75.5894, 6.2446],
      [-75.5923, 6.2456],
      [-75.5938, 6.2435],
    ],
  },
];

// ── Overpass API fetch ──
async function fetchOverpassRoads() {
  const radius = 1500; // meters
  const query = `
[out:json][timeout:30];
(
  way["highway"~"primary|secondary|tertiary"]["name"](around:${radius},${CENTER_LAT},${CENTER_LNG});
);
out body;
>;
out skel qt;
`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query.trim())}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "demo-diamante/1.0" },
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`  [traffic] Overpass fetch failed: ${err.message}`);
    return null;
  }
}

function overpassToLineStrings(data) {
  if (!data || !data.elements) return {};

  // Build node map
  const nodes = {};
  for (const el of data.elements) {
    if (el.type === "node") {
      nodes[el.id] = [el.lon, el.lat]; // [lng, lat]
    }
  }

  // Group ways by name
  const roadsByName = {};
  for (const el of data.elements) {
    if (el.type === "way" && el.tags && el.tags.name) {
      const name = el.tags.name;
      if (!roadsByName[name]) roadsByName[name] = [];
      const coords = (el.nodes || [])
        .map((nid) => nodes[nid])
        .filter(Boolean);
      if (coords.length >= 2) {
        roadsByName[name].push(coords);
      }
    }
  }

  // Merge connected segments for each road name into a single LineString
  const merged = {};
  for (const [name, segments] of Object.entries(roadsByName)) {
    if (segments.length === 0) continue;
    // Simple merge: concatenate segments sorted by first coordinate longitude
    const sorted = segments.sort((a, b) => a[0][0] - b[0][0]);
    // Try to connect end-to-start
    let result = [...sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const seg = sorted[i];
      const lastPt = result[result.length - 1];
      const firstPt = seg[0];
      const lastPtR = seg[seg.length - 1];
      // Check which end connects better
      const distForward = Math.hypot(lastPt[0] - firstPt[0], lastPt[1] - firstPt[1]);
      const distReverse = Math.hypot(lastPt[0] - lastPtR[0], lastPt[1] - lastPtR[1]);
      if (distReverse < distForward) {
        seg.reverse();
      }
      // Skip duplicate junction point
      const skipFirst =
        Math.hypot(result[result.length - 1][0] - seg[0][0], result[result.length - 1][1] - seg[0][1]) < 0.0001;
      result.push(...seg.slice(skipFirst ? 1 : 0));
    }
    merged[name] = result;
  }

  return merged;
}

function matchCorridorGeometry(corridorDef, roadGeometries) {
  // Try exact name match
  const overpassName = corridorDef.overpassName;
  if (roadGeometries[overpassName]) {
    return roadGeometries[overpassName];
  }
  // Try aliases
  const aliases = corridorDef.overpassAliases || [];
  for (const alias of aliases) {
    if (roadGeometries[alias]) {
      return roadGeometries[alias];
    }
  }
  // Try partial match against all names
  const searchNames = [overpassName, ...aliases];
  for (const searchName of searchNames) {
    for (const [name, coords] of Object.entries(roadGeometries)) {
      if (
        name.toLowerCase().includes(searchName.toLowerCase()) ||
        searchName.toLowerCase().includes(name.toLowerCase())
      ) {
        return coords;
      }
    }
  }
  // Fallback to predefined coordinates
  return corridorDef.fallbackCoords;
}

// ── Main pipeline ──
export default async function prepareTraffic() {
  console.log("  [traffic] Reading aforos CSV...");
  const { rows: aforosRaw } = readCSV(SRC_AFOROS);
  console.log(`  [traffic] Total aforo rows: ${aforosRaw.length}`);

  // Filter for Laureles-Estadio (COMUNA field = "Laureles - Estadio")
  const aforosLaureles = aforosRaw.filter(
    (r) => r["COMUNA"] === "Laureles - Estadio" || r["CODIGO"] === "11"
  );
  console.log(`  [traffic] Laureles-Estadio rows: ${aforosLaureles.length}`);

  // ── Aggregate 15-min data to hourly by intersection ──
  // Key: intersection name → hour → accumulated counts
  const aforoAgg = {};
  for (const row of aforosLaureles) {
    const intersection = row["INTERSECCIÓN"] || "Unknown";
    const horaStr = row["HORA"] || "";
    const hour = parseInt(horaStr.split(":")[0], 10);
    if (isNaN(hour)) continue;

    const key = intersection;
    if (!aforoAgg[key]) {
      aforoAgg[key] = {
        intersection,
        x: parseFloat(row["COORDENADAX"]) || 0,
        y: parseFloat(row["COORDENADAY"]) || 0,
        hours: {},
        sampleCount: {},
      };
    }
    // Use 15-min granularity data (AUTOS, BUSES, etc.) and sum to hourly
    if (!aforoAgg[key].hours[hour]) {
      aforoAgg[key].hours[hour] = {
        autos: 0,
        buses: 0,
        camiones: 0,
        motos: 0,
        bicicletas: 0,
        count: 0, // number of 15-min periods summed
      };
    }
    const h = aforoAgg[key].hours[hour];
    h.autos += parseInt(row["AUTOS"], 10) || 0;
    h.buses += parseInt(row["BUSES"], 10) || 0;
    h.camiones += parseInt(row["CAMIONES"], 10) || 0;
    h.motos += parseInt(row["MOTOS"], 10) || 0;
    h.bicicletas += parseInt(row["BICICLETAS"], 10) || 0;
    h.count += 1;

    // Update coordinates (take last non-zero)
    const x = parseFloat(row["COORDENADAX"]);
    const y = parseFloat(row["COORDENADAY"]);
    if (x && y) {
      aforoAgg[key].x = x;
      aforoAgg[key].y = y;
    }
  }

  // ── Parse velocity data for relevant corridors ──
  console.log("  [traffic] Reading velocity CSV...");
  const { rows: velRaw } = readCSV(SRC_VELOCITY);
  console.log(`  [traffic] Total velocity rows: ${velRaw.length}`);

  const relevantCorredores = new Set(
    CORRIDOR_DEFS.map((c) => c.velocityCorredor).filter(Boolean)
  );

  // Aggregate: corridor name → hour → { speeds: [], count }
  const velAgg = {};
  for (const row of velRaw) {
    const corredor = row["NOMBRE_CORREDOR"];
    if (!relevantCorredores.has(corredor)) continue;
    const hour = parseInt(row["HORA"], 10);
    const speed = parseFloat(row["VELOCIDAD_KM/H"]);
    if (isNaN(hour) || isNaN(speed) || speed <= 0) continue;

    if (!velAgg[corredor]) velAgg[corredor] = {};
    if (!velAgg[corredor][hour]) velAgg[corredor][hour] = { sum: 0, count: 0 };
    velAgg[corredor][hour].sum += speed;
    velAgg[corredor][hour].count += 1;
  }

  // Compute average speed per corridor per hour
  const avgSpeedByCorridor = {};
  for (const [corredor, hours] of Object.entries(velAgg)) {
    avgSpeedByCorridor[corredor] = {};
    for (const [hour, agg] of Object.entries(hours)) {
      avgSpeedByCorridor[corredor][hour] = Math.round((agg.sum / agg.count) * 10) / 10;
    }
  }

  console.log(
    `  [traffic] Velocity corridors with data: ${Object.keys(avgSpeedByCorridor).join(", ")}`
  );

  // ── Compute global average speed profile (for corridors without direct velocity data) ──
  const globalSpeedByHour = {};
  for (const hours of Object.values(velAgg)) {
    for (const [hour, agg] of Object.entries(hours)) {
      if (!globalSpeedByHour[hour]) globalSpeedByHour[hour] = { sum: 0, count: 0 };
      globalSpeedByHour[hour].sum += agg.sum;
      globalSpeedByHour[hour].count += agg.count;
    }
  }
  const fallbackSpeedByHour = {};
  for (const [hour, agg] of Object.entries(globalSpeedByHour)) {
    fallbackSpeedByHour[hour] = Math.round((agg.sum / agg.count) * 10) / 10;
  }

  // ── Fetch road geometries from Overpass API ──
  console.log("  [traffic] Fetching road geometries from Overpass API...");
  const overpassData = await fetchOverpassRoads();
  const roadGeometries = overpassToLineStrings(overpassData);
  const overpassRoadNames = Object.keys(roadGeometries);
  console.log(
    `  [traffic] Overpass roads found: ${overpassRoadNames.length}`
  );
  if (overpassRoadNames.length > 0) {
    console.log(`  [traffic] Overpass road names: ${overpassRoadNames.join(", ")}`);
  }

  // ── Map aforo intersections to corridors for volume assignment ──
  // Assign each intersection to the nearest corridor based on road name matching
  const corridorIntersections = {};
  for (const cdef of CORRIDOR_DEFS) {
    corridorIntersections[cdef.id] = [];
  }

  // Aliases for matching intersection names to corridor road names
  const CORRIDOR_ALIASES = {
    av80: ["avenida 80", "av. 80", "av 80", "carrera 80"],
    av33: ["avenida 33", "calle 33"],
    avsanjuan: ["calle 44", "san juan"],
    calle30: ["circular 1", "calle 30"],
    cra70: ["carrera 70"],
    cra65: ["carrera 65"],
    tv39b: ["transversal 39b", "transversal 39"],
    cra76: ["carrera 76"],
    calle49b: ["calle 49b", "calle 49", "bolivariana"],
    circ4: ["circular 4", "circular 73", "circ 4"],
  };

  for (const [intName, intData] of Object.entries(aforoAgg)) {
    const lower = intName.toLowerCase();
    let matched = false;
    for (const cdef of CORRIDOR_DEFS) {
      const aliases = CORRIDOR_ALIASES[cdef.id] || [cdef.overpassName.toLowerCase()];
      for (const alias of aliases) {
        if (lower.includes(alias)) {
          corridorIntersections[cdef.id].push(intName);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
  }

  // ── Build TrafficCorridor[] output ──
  const trafficCorridors = [];
  for (const cdef of CORRIDOR_DEFS) {
    const coords = matchCorridorGeometry(cdef, roadGeometries);

    // Aggregate hourly volumes from all intersections on this corridor
    const intNames = corridorIntersections[cdef.id];
    const hourlyMap = {};

    for (const intName of intNames) {
      const intData = aforoAgg[intName];
      if (!intData) continue;
      for (const [hourStr, counts] of Object.entries(intData.hours)) {
        const hour = parseInt(hourStr, 10);
        if (!hourlyMap[hour]) {
          hourlyMap[hour] = { autos: 0, motos: 0, buses: 0, camiones: 0, bicicletas: 0, nIntersections: 0 };
        }
        // Average across multiple dates (count = number of 15-min samples)
        // Each hour has 4 x 15-min periods, so divide by (count/4) to get average hourly
        const divisor = Math.max(1, counts.count / 4);
        hourlyMap[hour].autos += Math.round(counts.autos / divisor);
        hourlyMap[hour].motos += Math.round(counts.motos / divisor);
        hourlyMap[hour].buses += Math.round(counts.buses / divisor);
        hourlyMap[hour].camiones += Math.round(counts.camiones / divisor);
        hourlyMap[hour].bicicletas += Math.round(counts.bicicletas / divisor);
        hourlyMap[hour].nIntersections += 1;
      }
    }

    // Build hourly array (0-23)
    const hourly = [];
    for (let h = 0; h < 24; h++) {
      const hd = hourlyMap[h];
      let autos, motos, buses, camiones, bicicletas;

      if (hd && hd.nIntersections > 0) {
        // Real data available
        autos = Math.round(hd.autos / hd.nIntersections);
        motos = Math.round(hd.motos / hd.nIntersections);
        buses = Math.round(hd.buses / hd.nIntersections);
        camiones = Math.round(hd.camiones / hd.nIntersections);
        bicicletas = Math.round(hd.bicicletas / hd.nIntersections);
      } else {
        // Extrapolate from nearest available hours using typical profile
        const PROFILE = [
          0.05, 0.03, 0.02, 0.02, 0.05, 0.15,
          0.45, 0.85, 1.00, 0.70, 0.55, 0.60,
          0.75, 0.65, 0.55, 0.60, 0.80, 0.95,
          0.85, 0.55, 0.35, 0.25, 0.15, 0.08,
        ];
        // Find peak hour data to scale from
        const peakHour = Object.keys(hourlyMap)
          .map(Number)
          .sort((a, b) => {
            const aVol = hourlyMap[a] ? Object.values(hourlyMap[a]).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0) : 0;
            const bVol = hourlyMap[b] ? Object.values(hourlyMap[b]).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0) : 0;
            return bVol - aVol;
          })[0];

        if (peakHour !== undefined && hourlyMap[peakHour]) {
          const peak = hourlyMap[peakHour];
          const peakFactor = PROFILE[peakHour] || 1;
          const scaleFactor = (PROFILE[h] || 0.1) / peakFactor;
          const ni = peak.nIntersections || 1;
          autos = Math.round((peak.autos / ni) * scaleFactor);
          motos = Math.round((peak.motos / ni) * scaleFactor);
          buses = Math.round((peak.buses / ni) * scaleFactor);
          camiones = Math.round((peak.camiones / ni) * scaleFactor);
          bicicletas = Math.round((peak.bicicletas / ni) * scaleFactor);
        } else {
          // No data at all for this corridor — use minimal defaults
          autos = Math.round(50 * (PROFILE[h] || 0.1));
          motos = Math.round(40 * (PROFILE[h] || 0.1));
          buses = Math.round(5 * (PROFILE[h] || 0.1));
          camiones = Math.round(3 * (PROFILE[h] || 0.1));
          bicicletas = Math.round(5 * (PROFILE[h] || 0.1));
        }
      }

      const total = autos + motos + buses + camiones + bicicletas;

      // Speed: use corridor-specific velocity data, or fallback
      let avgSpeed;
      if (cdef.velocityCorredor && avgSpeedByCorridor[cdef.velocityCorredor] && avgSpeedByCorridor[cdef.velocityCorredor][h]) {
        avgSpeed = avgSpeedByCorridor[cdef.velocityCorredor][h];
      } else if (fallbackSpeedByHour[h]) {
        // Scale fallback by road type (local roads are slower)
        const localScale = cdef.velocityCorredor ? 1.0 : 0.75;
        avgSpeed = Math.round(fallbackSpeedByHour[h] * localScale * 10) / 10;
      } else {
        avgSpeed = 30;
      }

      hourly.push({ hour: h, autos, motos, buses, camiones, bicicletas, total, avgSpeed });
    }

    trafficCorridors.push({
      id: cdef.id,
      name: cdef.name,
      coordinates: coords,
      hourly,
    });
  }

  // ── Build TrafficAforo[] output ──
  const trafficAforos = [];
  for (const [intName, intData] of Object.entries(aforoAgg)) {
    const hourly = [];
    for (let h = 0; h < 24; h++) {
      const hd = intData.hours[h];
      if (hd) {
        // Average across sample dates: count = total 15-min samples across all dates
        // 4 samples per hour per date, so divisor = count/4 = number of date-samples
        const divisor = Math.max(1, hd.count / 4);
        const autos = Math.round(hd.autos / divisor);
        const motos = Math.round(hd.motos / divisor);
        const buses = Math.round(hd.buses / divisor);
        const camiones = Math.round(hd.camiones / divisor);
        const bicicletas = Math.round(hd.bicicletas / divisor);
        const total = autos + motos + buses + camiones + bicicletas;

        // Get speed from nearest corridor
        let avgSpeed = fallbackSpeedByHour[h] || 30;
        // Try to match intersection to a corridor for speed
        const lower = intName.toLowerCase();
        for (const cdef of CORRIDOR_DEFS) {
          if (cdef.velocityCorredor && avgSpeedByCorridor[cdef.velocityCorredor]) {
            const cname = cdef.overpassName.toLowerCase();
            if (lower.includes(cname)) {
              avgSpeed = avgSpeedByCorridor[cdef.velocityCorredor][h] || avgSpeed;
              break;
            }
          }
        }

        hourly.push({ hour: h, autos, motos, buses, camiones, bicicletas, total, avgSpeed });
      } else {
        // No data for this hour — extrapolate from available data
        const PROFILE = [
          0.05, 0.03, 0.02, 0.02, 0.05, 0.15,
          0.45, 0.85, 1.00, 0.70, 0.55, 0.60,
          0.75, 0.65, 0.55, 0.60, 0.80, 0.95,
          0.85, 0.55, 0.35, 0.25, 0.15, 0.08,
        ];
        // Find peak hour data
        const availableHours = Object.keys(intData.hours).map(Number);
        const peakHour = availableHours.sort((a, b) => {
          const aH = intData.hours[a];
          const bH = intData.hours[b];
          const aTotal = aH.autos + aH.motos + aH.buses + aH.camiones + aH.bicicletas;
          const bTotal = bH.autos + bH.motos + bH.buses + bH.camiones + bH.bicicletas;
          return bTotal - aTotal;
        })[0];

        if (peakHour !== undefined) {
          const peak = intData.hours[peakHour];
          const peakDivisor = Math.max(1, peak.count / 4);
          const peakFactor = PROFILE[peakHour] || 1;
          const scaleFactor = (PROFILE[h] || 0.1) / peakFactor;
          const autos = Math.round((peak.autos / peakDivisor) * scaleFactor);
          const motos = Math.round((peak.motos / peakDivisor) * scaleFactor);
          const buses = Math.round((peak.buses / peakDivisor) * scaleFactor);
          const camiones = Math.round((peak.camiones / peakDivisor) * scaleFactor);
          const bicicletas = Math.round((peak.bicicletas / peakDivisor) * scaleFactor);
          const total = autos + motos + buses + camiones + bicicletas;
          const avgSpeed = fallbackSpeedByHour[h] || 30;
          hourly.push({ hour: h, autos, motos, buses, camiones, bicicletas, total, avgSpeed });
        } else {
          hourly.push({ hour: h, autos: 0, motos: 0, buses: 0, camiones: 0, bicicletas: 0, total: 0, avgSpeed: 30 });
        }
      }
    }

    trafficAforos.push({
      intersection: intName,
      lat: intData.y,
      lng: intData.x,
      hourly,
    });
  }

  // ── Sort aforos by total peak volume descending ──
  trafficAforos.sort((a, b) => {
    const aPeak = Math.max(...a.hourly.map((h) => h.total));
    const bPeak = Math.max(...b.hourly.map((h) => h.total));
    return bPeak - aPeak;
  });

  // ── Write output files ──
  writeFileSync(resolve(OUT, "traffic-corridors.json"), JSON.stringify(trafficCorridors, null, 0));
  writeFileSync(resolve(OUT, "traffic-aforos.json"), JSON.stringify(trafficAforos, null, 0));

  // ── Stats ──
  console.log(`\n  [traffic] ═══ Output Stats ═══`);
  console.log(`  [traffic] traffic-corridors.json: ${trafficCorridors.length} corridors`);
  for (const c of trafficCorridors) {
    const peakHourly = c.hourly.reduce((max, h) => (h.total > max.total ? h : max), c.hourly[0]);
    const hasOverpass = roadGeometries[CORRIDOR_DEFS.find((d) => d.id === c.id)?.overpassName] ? "Overpass" : "fallback";
    const hasVelocity = CORRIDOR_DEFS.find((d) => d.id === c.id)?.velocityCorredor ? "real speed" : "estimated speed";
    const matchedInts = corridorIntersections[c.id]?.length || 0;
    console.log(
      `    ${c.id.padEnd(12)} ${c.name.padEnd(35)} ${c.coordinates.length} pts (${hasOverpass}) | peak h${peakHourly.hour}: ${peakHourly.total} veh, ${peakHourly.avgSpeed} km/h (${hasVelocity}) | ${matchedInts} intersections`
    );
  }

  console.log(`  [traffic] traffic-aforos.json: ${trafficAforos.length} intersections`);
  const top5 = trafficAforos.slice(0, 5);
  for (const a of top5) {
    const peakH = a.hourly.reduce((max, h) => (h.total > max.total ? h : max), a.hourly[0]);
    console.log(
      `    ${a.intersection.padEnd(35)} (${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}) peak h${peakH.hour}: ${peakH.total} veh/h`
    );
  }
  if (trafficAforos.length > 5) {
    console.log(`    ... and ${trafficAforos.length - 5} more`);
  }

  // Speed summary
  const corridorsWithSpeed = CORRIDOR_DEFS.filter((c) => c.velocityCorredor);
  for (const cdef of corridorsWithSpeed) {
    const speeds = avgSpeedByCorridor[cdef.velocityCorredor];
    if (!speeds) continue;
    const hours = Object.keys(speeds).map(Number).sort((a, b) => a - b);
    const minSpeed = Math.min(...hours.map((h) => speeds[h]));
    const maxSpeed = Math.max(...hours.map((h) => speeds[h]));
    console.log(
      `  [traffic] Speed ${cdef.velocityCorredor.padEnd(20)}: ${minSpeed}-${maxSpeed} km/h (${hours.length} hours of data)`
    );
  }
}

// Allow direct execution
if (process.argv[1] && process.argv[1].endsWith("prepare-traffic.mjs")) {
  prepareTraffic().catch(console.error);
}
