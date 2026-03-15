#!/usr/bin/env node
/**
 * prepare-boundaries.mjs
 * Fetches real geographic boundaries for Demo Diamante:
 *   1. Comuna 11 (Laureles-Estadio) boundary polygon
 *   2. Barrios within Comuna 11
 *   3. Atanasio Girardot stadium footprint + sports complex
 *   4. Road network for the area
 *
 * Sources: datos.gov.co, Overpass API (sequential with retry)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Bounding box for Comuna 11 area
const BBOX = "6.245,-75.600,6.268,-75.578";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function overpassQuery(query, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`  [boundaries] Fetching ${label} from Overpass (attempt ${attempt})...`);
    try {
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60000),
      });
      if (resp.status === 429) {
        console.log(`  [boundaries] Rate limited, waiting 15s...`);
        await sleep(15000);
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Overpass HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const data = await resp.json();
      console.log(`  [boundaries] ${label}: ${data.elements.length} elements`);
      return data;
    } catch (e) {
      if (attempt < retries) {
        console.log(`  [boundaries] ${label} attempt ${attempt} failed: ${e.message.slice(0, 100)}`);
        await sleep(10000);
      } else {
        throw e;
      }
    }
  }
}

// ============================================================
// 1. Comuna 11 boundary
// ============================================================
async function fetchComuna11() {
  // Try Overpass API for admin boundary
  console.log("  [boundaries] Trying Overpass for Comuna 11 boundary...");
  const query = `
[out:json][timeout:30];
(
  relation["admin_level"="9"]["name"~"Laureles|laureles|Estadio|estadio"](6.20,-75.62,6.30,-75.55);
  relation["admin_level"="8"]["name"~"Laureles|laureles|Estadio|estadio"](6.20,-75.62,6.30,-75.55);
  relation["boundary"="administrative"]["name"~"[Ll]aureles"](6.20,-75.62,6.30,-75.55);
  relation["boundary"="administrative"]["name"~"[Cc]omuna.*(11|once)"](6.20,-75.62,6.30,-75.55);
);
out body;
>;
out skel qt;
`;

  try {
    const data = await overpassQuery(query, "Comuna 11 admin boundary");
    const result = overpassToGeoJSON(data, "comuna11");
    if (result && result.features.length > 0) {
      return result;
    }
  } catch (e) {
    console.log(`  [boundaries] Comuna 11 Overpass failed: ${e.message.slice(0, 100)}`);
  }

  // Alternate query
  try {
    await sleep(3000);
    const query2 = `
[out:json][timeout:30];
rel["name"~"Laureles"]["boundary"](6.20,-75.62,6.30,-75.55);
out body;
>;
out skel qt;
`;
    const data2 = await overpassQuery(query2, "Comuna 11 alternate");
    const result2 = overpassToGeoJSON(data2, "comuna11");
    if (result2 && result2.features.length > 0) return result2;
  } catch (e) {
    console.log(`  [boundaries] Comuna 11 alternate failed: ${e.message.slice(0, 100)}`);
  }

  console.log("  [boundaries] Using known approximate boundary for Comuna 11...");
  return createApproximateComuna11();
}

function createApproximateComuna11() {
  // Well-documented approximate boundary of Comuna 11 (Laureles-Estadio)
  // Based on the actual geographic extent of the comuna
  const coords = [
    [-75.5992, 6.2622], [-75.5975, 6.2627], [-75.5958, 6.2636], [-75.5940, 6.2640],
    [-75.5920, 6.2641], [-75.5900, 6.2638], [-75.5880, 6.2632], [-75.5860, 6.2623],
    [-75.5840, 6.2610], [-75.5825, 6.2594], [-75.5815, 6.2578], [-75.5808, 6.2560],
    [-75.5803, 6.2540], [-75.5800, 6.2520], [-75.5800, 6.2500], [-75.5803, 6.2480],
    [-75.5810, 6.2462], [-75.5820, 6.2448], [-75.5833, 6.2437], [-75.5848, 6.2430],
    [-75.5865, 6.2426], [-75.5883, 6.2425], [-75.5900, 6.2427], [-75.5918, 6.2432],
    [-75.5935, 6.2440], [-75.5950, 6.2450], [-75.5963, 6.2463], [-75.5975, 6.2478],
    [-75.5985, 6.2495], [-75.5990, 6.2513], [-75.5994, 6.2532], [-75.5996, 6.2552],
    [-75.5997, 6.2572], [-75.5996, 6.2592], [-75.5993, 6.2610], [-75.5992, 6.2622],
  ];

  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        name: "Comuna 11 - Laureles-Estadio",
        comuna: "11",
        source: "approximate",
      },
      geometry: { type: "Polygon", coordinates: [coords] },
    }],
  };
}

// ============================================================
// 2. Barrios within Comuna 11
// ============================================================
async function fetchBarrios() {
  // Overpass for neighbourhoods
  const query = `
[out:json][timeout:45];
(
  relation["admin_level"="10"](6.245,-75.600,6.268,-75.578);
  relation["place"="neighbourhood"](6.245,-75.600,6.268,-75.578);
);
out body;
>;
out skel qt;
`;

  try {
    const data = await overpassQuery(query, "Barrios");
    const result = overpassToGeoJSON(data, "barrios");
    if (result && result.features.length > 0) return result;
  } catch (e) {
    console.log(`  [boundaries] Barrios Overpass failed: ${e.message.slice(0, 100)}`);
  }

  console.log("  [boundaries] Using known barrios for Comuna 11...");
  return createApproximateBarrios();
}

function createApproximateBarrios() {
  const barrios = [
    {
      name: "Carlos E. Restrepo",
      coords: [[-75.5872,6.2530],[-75.5848,6.2530],[-75.5840,6.2555],[-75.5850,6.2575],[-75.5875,6.2575],[-75.5880,6.2550],[-75.5872,6.2530]],
    },
    {
      name: "Suramericana",
      coords: [[-75.5920,6.2530],[-75.5880,6.2530],[-75.5875,6.2575],[-75.5920,6.2580],[-75.5930,6.2555],[-75.5920,6.2530]],
    },
    {
      name: "Naranjal",
      coords: [[-75.5960,6.2520],[-75.5930,6.2520],[-75.5920,6.2555],[-75.5935,6.2575],[-75.5960,6.2570],[-75.5965,6.2545],[-75.5960,6.2520]],
    },
    {
      name: "San Joaquin",
      coords: [[-75.5880,6.2440],[-75.5848,6.2445],[-75.5840,6.2470],[-75.5845,6.2500],[-75.5875,6.2505],[-75.5885,6.2480],[-75.5880,6.2440]],
    },
    {
      name: "Los Conquistadores",
      coords: [[-75.5925,6.2440],[-75.5885,6.2440],[-75.5880,6.2480],[-75.5920,6.2490],[-75.5930,6.2470],[-75.5925,6.2440]],
    },
    {
      name: "Bolivariana",
      coords: [[-75.5965,6.2440],[-75.5930,6.2440],[-75.5920,6.2470],[-75.5930,6.2500],[-75.5960,6.2500],[-75.5970,6.2475],[-75.5965,6.2440]],
    },
    {
      name: "Laureles",
      coords: [[-75.5940,6.2575],[-75.5900,6.2575],[-75.5895,6.2610],[-75.5920,6.2630],[-75.5945,6.2620],[-75.5950,6.2595],[-75.5940,6.2575]],
    },
    {
      name: "Las Acacias",
      coords: [[-75.5895,6.2575],[-75.5860,6.2570],[-75.5850,6.2600],[-75.5870,6.2625],[-75.5900,6.2620],[-75.5900,6.2595],[-75.5895,6.2575]],
    },
    {
      name: "La Castellana",
      coords: [[-75.5990,6.2535],[-75.5965,6.2530],[-75.5955,6.2570],[-75.5965,6.2595],[-75.5990,6.2585],[-75.5995,6.2555],[-75.5990,6.2535]],
    },
    {
      name: "Estadio",
      coords: [[-75.5910,6.2490],[-75.5885,6.2490],[-75.5880,6.2525],[-75.5895,6.2545],[-75.5920,6.2540],[-75.5920,6.2510],[-75.5910,6.2490]],
    },
    {
      name: "Los Colores",
      coords: [[-75.5990,6.2460],[-75.5965,6.2455],[-75.5955,6.2485],[-75.5965,6.2520],[-75.5990,6.2515],[-75.5995,6.2485],[-75.5990,6.2460]],
    },
    {
      name: "Velodromo",
      coords: [[-75.5855,6.2485],[-75.5830,6.2490],[-75.5820,6.2520],[-75.5835,6.2545],[-75.5855,6.2540],[-75.5860,6.2510],[-75.5855,6.2485]],
    },
    {
      name: "La America (sector Laureles)",
      coords: [[-75.5840,6.2445],[-75.5810,6.2455],[-75.5805,6.2485],[-75.5830,6.2500],[-75.5848,6.2490],[-75.5850,6.2465],[-75.5840,6.2445]],
    },
    {
      name: "Lorena",
      coords: [[-75.5960,6.2585],[-75.5945,6.2585],[-75.5935,6.2615],[-75.5950,6.2635],[-75.5975,6.2625],[-75.5975,6.2600],[-75.5960,6.2585]],
    },
    {
      name: "El Danubio",
      coords: [[-75.5830,6.2570],[-75.5810,6.2575],[-75.5805,6.2600],[-75.5820,6.2615],[-75.5840,6.2610],[-75.5845,6.2590],[-75.5830,6.2570]],
    },
    {
      name: "Florida Nueva",
      coords: [[-75.5880,6.2610],[-75.5855,6.2605],[-75.5845,6.2625],[-75.5860,6.2640],[-75.5885,6.2635],[-75.5890,6.2620],[-75.5880,6.2610]],
    },
  ];

  return {
    type: "FeatureCollection",
    features: barrios.map(b => ({
      type: "Feature",
      properties: { name: b.name, comuna: "11", source: "approximate" },
      geometry: { type: "Polygon", coordinates: [b.coords] },
    })),
  };
}

// ============================================================
// 3. Stadium footprint + sports complex
// ============================================================
async function fetchStadium() {
  const query = `
[out:json][timeout:30];
(
  way["name"~"[Aa]tanasio"](6.24,-75.60,6.27,-75.57);
  way["leisure"="stadium"](6.248,-75.595,6.265,-75.580);
  way["leisure"="sports_centre"](6.248,-75.595,6.265,-75.580);
  way["leisure"="pitch"](6.252,-75.592,6.262,-75.584);
  way["building"]["sport"](6.252,-75.592,6.262,-75.584);
  relation["name"~"[Aa]tanasio"](6.24,-75.60,6.27,-75.57);
  way["name"~"[Gg]irardot"](6.24,-75.60,6.27,-75.57);
  way["amenity"="swimming_pool"](6.252,-75.592,6.262,-75.584);
  way["leisure"="swimming_pool"](6.252,-75.592,6.262,-75.584);
);
out body;
>;
out skel qt;
`;

  try {
    const data = await overpassQuery(query, "Stadium + sports complex");
    const result = overpassWaysToGeoJSON(data, "stadium");
    if (result && result.features.length > 0) return result;
  } catch (e) {
    console.log(`  [boundaries] Stadium Overpass failed: ${e.message.slice(0, 100)}`);
  }

  // Fallback: try simpler query just for the stadium
  try {
    await sleep(3000);
    const query2 = `
[out:json][timeout:30];
(
  way["leisure"="stadium"](6.25,-75.595,6.262,-75.583);
  way["leisure"="pitch"](6.254,-75.591,6.260,-75.585);
);
out body;
>;
out skel qt;
`;
    const data2 = await overpassQuery(query2, "Stadium simple query");
    const result2 = overpassWaysToGeoJSON(data2, "stadium");
    if (result2 && result2.features.length > 0) return result2;
  } catch (e) {
    console.log(`  [boundaries] Stadium simple query failed: ${e.message.slice(0, 100)}`);
  }

  // Use known stadium coordinates
  console.log("  [boundaries] Using known stadium footprint...");
  return createApproximateStadium();
}

function createApproximateStadium() {
  // Atanasio Girardot stadium - well-known footprint
  // The stadium is roughly oval, centered near 6.2568, -75.5880
  const stadiumCoords = [];
  const cx = -75.5880, cy = 6.2568;
  const rx = 0.0014, ry = 0.0010; // semi-axes in degrees
  for (let i = 0; i < 36; i++) {
    const angle = (2 * Math.PI * i) / 36;
    stadiumCoords.push([
      Math.round((cx + rx * Math.cos(angle)) * 100000) / 100000,
      Math.round((cy + ry * Math.sin(angle)) * 100000) / 100000,
    ]);
  }
  stadiumCoords.push(stadiumCoords[0]);

  // Sports complex nearby buildings
  const features = [
    {
      type: "Feature",
      properties: {
        name: "Estadio Atanasio Girardot",
        type: "stadium",
        leisure: "stadium",
        sport: "soccer",
        capacity: "40943",
        source: "approximate",
      },
      geometry: { type: "Polygon", coordinates: [stadiumCoords] },
    },
    {
      type: "Feature",
      properties: {
        name: "Coliseo Ivan de Bedout",
        type: "sports_centre",
        sport: "basketball",
        source: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-75.5865, 6.2555], [-75.5855, 6.2555], [-75.5855, 6.2562],
          [-75.5865, 6.2562], [-75.5865, 6.2555],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Piscina Olimpica",
        type: "swimming_pool",
        sport: "swimming",
        source: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-75.5895, 6.2555], [-75.5885, 6.2555], [-75.5885, 6.2560],
          [-75.5895, 6.2560], [-75.5895, 6.2555],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Coliseo Yesid Santos",
        type: "sports_centre",
        sport: "multi",
        source: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-75.5878, 6.2548], [-75.5870, 6.2548], [-75.5870, 6.2555],
          [-75.5878, 6.2555], [-75.5878, 6.2548],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Velodromo Martin Emilio Cochise Rodriguez",
        type: "pitch",
        sport: "cycling",
        source: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-75.5870, 6.2576], [-75.5858, 6.2576], [-75.5855, 6.2580],
          [-75.5855, 6.2586], [-75.5858, 6.2590], [-75.5870, 6.2590],
          [-75.5873, 6.2586], [-75.5873, 6.2580], [-75.5870, 6.2576],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Diamante Deportivo y Cultural",
        type: "sports_centre",
        source: "approximate",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-75.5900, 6.2545], [-75.5850, 6.2545], [-75.5850, 6.2595],
          [-75.5900, 6.2595], [-75.5900, 6.2545],
        ]],
      },
    },
  ];

  return { type: "FeatureCollection", features };
}

// ============================================================
// 4. Road network
// ============================================================
async function fetchRoadNetwork() {
  const query = `
[out:json][timeout:45];
(
  way["highway"~"^(primary|secondary|tertiary|residential|living_street|pedestrian|service|unclassified)$"](${BBOX});
);
out body;
>;
out skel qt;
`;

  const data = await overpassQuery(query, "Road network");
  return overpassWaysToLineStrings(data);
}

// ============================================================
// Overpass data conversion helpers
// ============================================================
function overpassToGeoJSON(data, label) {
  const nodes = new Map();
  const ways = new Map();
  const relations = [];

  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
    else if (el.type === "way") ways.set(el.id, el);
    else if (el.type === "relation") relations.push(el);
  }

  const features = [];

  // Process relations first
  for (const rel of relations) {
    const outerRings = [];
    const innerRings = [];

    for (const member of rel.members || []) {
      if (member.type !== "way") continue;
      const way = ways.get(member.ref);
      if (!way) continue;
      const coords = (way.nodes || []).map(nid => nodes.get(nid)).filter(Boolean);
      if (coords.length < 3) continue;

      if (member.role === "inner") {
        innerRings.push(coords);
      } else {
        outerRings.push(coords);
      }
    }

    const mergedOuter = mergeWaySegments(outerRings);

    if (mergedOuter.length > 0) {
      for (const ring of mergedOuter) {
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push(ring[0]);
        }
        const coordinates = [ring];
        for (const inner of innerRings) {
          if (inner[0][0] !== inner[inner.length - 1][0] || inner[0][1] !== inner[inner.length - 1][1]) {
            inner.push(inner[0]);
          }
          coordinates.push(inner);
        }

        features.push({
          type: "Feature",
          properties: {
            name: rel.tags?.name || label,
            ...rel.tags,
            source: "openstreetmap",
          },
          geometry: { type: "Polygon", coordinates },
        });
      }
    }
  }

  // Also check standalone closed ways
  for (const [, way] of ways) {
    if (!way.nodes || way.nodes.length < 4) continue;
    if (way.nodes[0] !== way.nodes[way.nodes.length - 1]) continue;
    const isPartOfRelation = relations.some(r =>
      (r.members || []).some(m => m.ref === way.id)
    );
    if (isPartOfRelation) continue;

    const coords = way.nodes.map(nid => nodes.get(nid)).filter(Boolean);
    if (coords.length < 4) continue;
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    features.push({
      type: "Feature",
      properties: {
        name: way.tags?.name || label,
        ...way.tags,
        source: "openstreetmap",
      },
      geometry: { type: "Polygon", coordinates: [coords] },
    });
  }

  console.log(`  [boundaries] ${label}: converted to ${features.length} GeoJSON features`);
  return { type: "FeatureCollection", features };
}

function mergeWaySegments(segments) {
  if (segments.length === 0) return [];
  const remaining = [...segments];
  const merged = [];

  while (remaining.length > 0) {
    let current = remaining.shift();
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const curEnd = current[current.length - 1];
        const curStart = current[0];
        const segStart = seg[0];
        const segEnd = seg[seg.length - 1];

        const EPS = 1e-7;
        const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

        if (same(curEnd, segStart)) {
          current = current.concat(seg.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (same(curEnd, segEnd)) {
          current = current.concat(seg.reverse().slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (same(curStart, segEnd)) {
          current = seg.concat(current.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (same(curStart, segStart)) {
          current = seg.reverse().concat(current.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

function overpassWaysToGeoJSON(data, label) {
  const nodes = new Map();
  const ways = [];
  const relations = [];

  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
    else if (el.type === "way") ways.push(el);
    else if (el.type === "relation") relations.push(el);
  }

  const features = [];

  // Process relations (like multipolygon for the stadium)
  for (const rel of relations) {
    const outerSegments = [];
    const innerSegments = [];

    for (const member of rel.members || []) {
      if (member.type !== "way") continue;
      const way = ways.find(w => w.id === member.ref);
      if (!way) continue;
      const coords = (way.nodes || []).map(nid => nodes.get(nid)).filter(Boolean);
      if (coords.length < 2) continue;

      if (member.role === "inner") {
        innerSegments.push(coords);
      } else {
        outerSegments.push(coords);
      }
    }

    const mergedOuter = mergeWaySegments(outerSegments);
    for (const ring of mergedOuter) {
      if (ring.length < 3) continue;
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      const coordinates = [ring];
      for (const inner of innerSegments) {
        if (inner[0][0] !== inner[inner.length - 1][0] || inner[0][1] !== inner[inner.length - 1][1]) {
          inner.push(inner[0]);
        }
        coordinates.push(inner);
      }
      features.push({
        type: "Feature",
        properties: {
          name: rel.tags?.name || label,
          type: rel.tags?.leisure || rel.tags?.building || rel.tags?.sport || "building",
          ...rel.tags,
          source: "openstreetmap",
        },
        geometry: { type: "Polygon", coordinates },
      });
    }
  }

  // Process closed ways
  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 3) continue;
    const isPartOfRel = relations.some(r =>
      (r.members || []).some(m => m.ref === way.id)
    );

    const isClosed = way.nodes[0] === way.nodes[way.nodes.length - 1];
    if (!isClosed) continue;

    const coords = way.nodes.map(nid => nodes.get(nid)).filter(Boolean);
    if (coords.length < 3) continue;

    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    // Skip ways already part of relations unless they have their own tags
    if (isPartOfRel && !way.tags?.name && !way.tags?.leisure && !way.tags?.sport) continue;

    features.push({
      type: "Feature",
      properties: {
        name: way.tags?.name || label,
        type: way.tags?.leisure || way.tags?.building || way.tags?.sport || "building",
        ...way.tags,
        source: "openstreetmap",
      },
      geometry: { type: "Polygon", coordinates: [coords] },
    });
  }

  console.log(`  [boundaries] ${label}: ${features.length} polygon features`);
  return { type: "FeatureCollection", features };
}

function overpassWaysToLineStrings(data) {
  const nodes = new Map();
  const ways = [];

  for (const el of data.elements) {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
    else if (el.type === "way") ways.push(el);
  }

  const features = [];
  for (const way of ways) {
    if (!way.nodes || way.nodes.length < 2) continue;
    const coords = way.nodes.map(nid => nodes.get(nid)).filter(Boolean);
    if (coords.length < 2) continue;

    features.push({
      type: "Feature",
      properties: {
        name: way.tags?.name || "",
        highway: way.tags?.highway || "",
        oneway: way.tags?.oneway || "no",
        surface: way.tags?.surface || "",
        lanes: way.tags?.lanes || "",
        source: "openstreetmap",
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  console.log(`  [boundaries] Road network: ${features.length} line features`);
  return { type: "FeatureCollection", features };
}

// ============================================================
// Main — sequential to avoid Overpass rate limits
// ============================================================
export default async function prepareBoundaries() {
  console.log("  [boundaries] Starting boundary data preparation...\n");

  // 1. Road network (this is independent)
  let roads;
  try {
    roads = await fetchRoadNetwork();
  } catch (e) {
    console.log(`  [boundaries] Road network fetch failed: ${e.message.slice(0, 100)}`);
    roads = { type: "FeatureCollection", features: [] };
  }

  // Brief pause between queries
  await sleep(5000);

  // 2. Stadium
  const stadium = await fetchStadium();

  await sleep(5000);

  // 3. Comuna 11
  const comuna11 = await fetchComuna11();

  await sleep(5000);

  // 4. Barrios
  const barrios = await fetchBarrios();

  // Write files
  const files = [
    { name: "comuna11-boundary.json", data: comuna11 },
    { name: "barrios-comuna11.json", data: barrios },
    { name: "stadium-footprint.json", data: stadium },
    { name: "road-network.json", data: roads },
  ];

  for (const { name, data } of files) {
    const path = resolve(OUT, name);
    const json = JSON.stringify(data);
    writeFileSync(path, json);
    const sizeKb = (json.length / 1024).toFixed(1);
    const count = data.features?.length || 0;
    console.log(`  [boundaries] Wrote ${name} (${count} features, ${sizeKb} KB)`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("prepare-boundaries.mjs")) {
  prepareBoundaries().catch(console.error);
}
