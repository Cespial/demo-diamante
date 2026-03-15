#!/usr/bin/env node
/**
 * prepare-parking.mjs
 * Fetches parking amenities from Overpass API around the Diamante.
 * Falls back to synthetic data if the API call fails.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const CENTER = { lat: 6.2565, lon: -75.5905 };
const RADIUS = 1500;

async function fetchOverpass() {
  const query = `
[out:json][timeout:30];
(
  node["amenity"="parking"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["amenity"="parking"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  relation["amenity"="parking"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
);
out center body;
`;
  const url = "https://overpass-api.de/api/interpreter";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  const data = await resp.json();
  return data.elements || [];
}

function overpassToGeoJSON(elements) {
  const features = elements.map((el) => {
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;
    if (!lat || !lon) return null;
    const tags = el.tags || {};

    // Estimate capacity from area or tag
    let capacity = parseInt(tags.capacity, 10) || null;
    if (!capacity && el.type === "way" && el.bounds) {
      const dLat = Math.abs(el.bounds.maxlat - el.bounds.minlat) * 111320;
      const dLon = Math.abs(el.bounds.maxlon - el.bounds.minlon) * 111320 * Math.cos((lat * Math.PI) / 180);
      const area = dLat * dLon;
      capacity = Math.max(5, Math.round(area / 25)); // ~25m2 per space
    }
    if (!capacity) capacity = Math.round(10 + Math.random() * 30);

    // Tariff estimation (COP per hour)
    const isUnderground = (tags.parking || "").includes("underground") || (tags.building || "") === "parking";
    const tariffMin = isUnderground ? 4000 : 2500;
    const tariffMax = isUnderground ? 8000 : 5000;

    return {
      type: "Feature",
      properties: {
        id: `osm-${el.type}-${el.id}`,
        name: tags.name || tags["name:es"] || "Parqueadero",
        parking_type: tags.parking || "surface",
        access: tags.access || "public",
        capacity,
        tariff_cop_min: tariffMin,
        tariff_cop_max: tariffMax,
        fee: tags.fee || "yes",
        operator: tags.operator || null,
        source: "osm",
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    };
  }).filter(Boolean);

  return {
    type: "FeatureCollection",
    metadata: { source: "overpass-api", generated: new Date().toISOString(), center: CENTER, radius_m: RADIUS },
    features,
  };
}

function generateSyntheticParking() {
  const spots = [
    { name: "Parqueadero Centro Comercial Unicentro", lat: 6.2585, lon: -75.5865, type: "underground", capacity: 450 },
    { name: "Parqueadero Atanasio Girardot", lat: 6.2555, lon: -75.5890, type: "surface", capacity: 300 },
    { name: "Parqueadero El Diamante", lat: 6.2570, lon: -75.5905, type: "surface", capacity: 80 },
    { name: "Parqueadero Primer Parque de Laureles", lat: 6.2580, lon: -75.5920, type: "surface", capacity: 35 },
    { name: "Parqueadero Oviedo", lat: 6.2610, lon: -75.5845, type: "underground", capacity: 500 },
    { name: "Parqueadero Florida", lat: 6.2540, lon: -75.5870, type: "surface", capacity: 60 },
    { name: "Parqueadero Cra 70 Sur", lat: 6.2520, lon: -75.5880, type: "surface", capacity: 45 },
    { name: "Parqueadero La 33", lat: 6.2510, lon: -75.5840, type: "surface", capacity: 55 },
    { name: "Parqueadero Circular", lat: 6.2550, lon: -75.5895, type: "surface", capacity: 40 },
    { name: "Parqueadero Los Colores", lat: 6.2620, lon: -75.5920, type: "surface", capacity: 70 },
    { name: "Parqueadero Estadio Metro", lat: 6.2560, lon: -75.5868, type: "multi-storey", capacity: 120 },
    { name: "Parqueadero CC Viva Laureles", lat: 6.2590, lon: -75.5930, type: "underground", capacity: 380 },
    { name: "Parqueadero Club El Rodeo", lat: 6.2545, lon: -75.5935, type: "surface", capacity: 90 },
    { name: "Parqueadero Hotel Dann Carlton", lat: 6.2575, lon: -75.5855, type: "underground", capacity: 100 },
    { name: "Parqueadero Suramericana", lat: 6.2605, lon: -75.5880, type: "underground", capacity: 200 },
  ];

  const features = spots.map((s, i) => {
    const isUnder = s.type === "underground" || s.type === "multi-storey";
    return {
      type: "Feature",
      properties: {
        id: `syn-parking-${i + 1}`,
        name: s.name,
        parking_type: s.type,
        access: "public",
        capacity: s.capacity,
        tariff_cop_min: isUnder ? 4000 : 2500,
        tariff_cop_max: isUnder ? 8000 : 5000,
        fee: "yes",
        operator: null,
        source: "synthetic",
      },
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    };
  });

  return {
    type: "FeatureCollection",
    metadata: { source: "synthetic", generated: new Date().toISOString(), center: CENTER, radius_m: RADIUS },
    features,
  };
}

export default async function prepareParking() {
  let geojson;
  try {
    console.log("  [parking] Fetching from Overpass API...");
    const elements = await fetchOverpass();
    if (elements.length === 0) throw new Error("No results");
    geojson = overpassToGeoJSON(elements);
    console.log(`  [parking] Got ${geojson.features.length} parking features from OSM`);
  } catch (err) {
    console.log(`  [parking] Overpass failed (${err.message}), using synthetic data...`);
    geojson = generateSyntheticParking();
    console.log(`  [parking] Generated ${geojson.features.length} synthetic parking features`);
  }

  writeFileSync(resolve(OUT, "parking-pois.json"), JSON.stringify(geojson));
  console.log("  [parking] Wrote parking-pois.json");
}

if (process.argv[1] && process.argv[1].endsWith("prepare-parking.mjs")) {
  prepareParking().catch(console.error);
}
