#!/usr/bin/env node
/**
 * prepare-pedestrian.mjs
 * Grid-based pedestrian intensity model for the Diamante area.
 * Produces a GeoJSON heatmap with intensity values based on:
 *   - Distance decay from center
 *   - Commerce density (POIs within 200m)
 *   - Hotel proximity (tourist foot traffic)
 *   - Incident density (traffic/people proxy)
 *   - Time-of-day multipliers
 *   - Day-of-week multipliers
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

// ── Configuration ──────────────────────────────────────────────────
const CENTER = { lat: 6.2565, lng: -75.5905 };
const RADIUS_M = 1500; // 1.5 km
const GRID_SPACING_M = 100; // ~100m between points
const POI_RADIUS_M = 200; // radius for POI density counting

// ── Haversine distance (meters) ────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Meters to degree offsets at given latitude ─────────────────────
function metersToDegreesLat(m) {
  return m / 111_320;
}
function metersToDegreesLng(m, lat) {
  return m / (111_320 * Math.cos((lat * Math.PI) / 180));
}

// ── Load source data ───────────────────────────────────────────────
function loadJSON(filename) {
  const path = resolve(OUT, filename);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.warn(`  Warning: Could not load ${filename}: ${e.message}`);
    return [];
  }
}

// ── Hourly multipliers ────────────────────────────────────────────
function hourlyMultiplier(hour) {
  if (hour >= 0 && hour < 6) return 0.1;
  if (hour >= 6 && hour < 8) return 0.3;
  if (hour >= 8 && hour < 12) return 0.6;
  if (hour >= 12 && hour < 14) return 0.8;
  if (hour >= 14 && hour < 17) return 0.5;
  if (hour >= 17 && hour < 20) return 0.9;
  if (hour >= 20 && hour < 22) return 0.7;
  if (hour >= 22 && hour <= 23) return 0.3;
  return 0.1;
}

// ── Day-of-week multiplier ─────────────────────────────────────────
// 0=Sun, 1=Mon, ..., 6=Sat
function dayMultiplier(dayOfWeek) {
  if (dayOfWeek === 0) return 0.8; // Sunday
  if (dayOfWeek === 6) return 1.3; // Saturday
  return 1.0; // weekday
}

// ── Build spatial index (simple grid bucketing) ────────────────────
function buildSpatialIndex(points, bucketSizeDeg) {
  const index = new Map();
  for (const p of points) {
    const bx = Math.floor(p.lng / bucketSizeDeg);
    const by = Math.floor(p.lat / bucketSizeDeg);
    const key = `${bx},${by}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(p);
  }
  return { index, bucketSizeDeg };
}

function queryNearby(spatialIdx, lat, lng, radiusM) {
  const { index, bucketSizeDeg } = spatialIdx;
  const radiusDeg = radiusM / 111_320; // approximate
  const searchBuckets = Math.ceil(radiusDeg / bucketSizeDeg) + 1;
  const bx0 = Math.floor(lng / bucketSizeDeg);
  const by0 = Math.floor(lat / bucketSizeDeg);
  let count = 0;

  for (let dx = -searchBuckets; dx <= searchBuckets; dx++) {
    for (let dy = -searchBuckets; dy <= searchBuckets; dy++) {
      const key = `${bx0 + dx},${by0 + dy}`;
      const bucket = index.get(key);
      if (!bucket) continue;
      for (const p of bucket) {
        if (haversine(lat, lng, p.lat, p.lng) <= radiusM) {
          count++;
        }
      }
    }
  }
  return count;
}

// ── Main ───────────────────────────────────────────────────────────
export default async function preparePedestrian() {
  console.log("  [pedestrian] Loading source data...");

  const commercePOIs = loadJSON("commerce-pois.json");
  const hotelPOIs = loadJSON("hotels-pois.json");
  const incidents = loadJSON("incidents-laureles.json");

  // Normalize to {lat, lng} arrays
  const allPOIs = [
    ...commercePOIs.map((p) => ({ lat: p.lat, lng: p.lng, type: "commerce" })),
    ...hotelPOIs.map((p) => ({ lat: p.lat, lng: p.lng, type: "hotel" })),
  ];

  const incidentPoints = Array.isArray(incidents)
    ? incidents.map((i) => ({ lat: i.lat, lng: i.lng }))
    : (incidents.features || []).map((f) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));

  console.log(
    `  [pedestrian] Loaded ${commercePOIs.length} commerce, ${hotelPOIs.length} hotels, ${incidentPoints.length} incidents`
  );

  // Build spatial indices for fast proximity queries
  const bucketSize = 0.002; // ~220m buckets
  const commerceIdx = buildSpatialIndex(
    commercePOIs.map((p) => ({ lat: p.lat, lng: p.lng })),
    bucketSize
  );
  const hotelIdx = buildSpatialIndex(
    hotelPOIs.map((p) => ({ lat: p.lat, lng: p.lng })),
    bucketSize
  );
  const incidentIdx = buildSpatialIndex(incidentPoints, bucketSize);

  // ── Generate grid points ──────────────────────────────────────
  console.log("  [pedestrian] Generating grid...");

  const dLat = metersToDegreesLat(GRID_SPACING_M);
  const dLng = metersToDegreesLng(GRID_SPACING_M, CENTER.lat);
  const radiusLat = metersToDegreesLat(RADIUS_M);
  const radiusLng = metersToDegreesLng(RADIUS_M, CENTER.lat);

  const features = [];
  let gridPointCount = 0;

  for (
    let lat = CENTER.lat - radiusLat;
    lat <= CENTER.lat + radiusLat;
    lat += dLat
  ) {
    for (
      let lng = CENTER.lng - radiusLng;
      lng <= CENTER.lng + radiusLng;
      lng += dLng
    ) {
      // Only include points within circular radius
      const distFromCenter = haversine(lat, lng, CENTER.lat, CENTER.lng);
      if (distFromCenter > RADIUS_M) continue;

      gridPointCount++;

      // ── Distance decay (0-1, closer to center = higher) ──
      const distanceFactor = Math.max(0, 1 - distFromCenter / RADIUS_M);
      // Use exponential decay for more realistic falloff
      const distanceScore = Math.pow(distanceFactor, 0.7);

      // ── Commerce density ──
      const commerceCount = queryNearby(
        commerceIdx,
        lat,
        lng,
        POI_RADIUS_M
      );
      // Normalize: assume max ~30 POIs within 200m is "dense"
      const commerceScore = Math.min(commerceCount / 30, 1);

      // ── Hotel proximity ──
      const hotelCount = queryNearby(hotelIdx, lat, lng, POI_RADIUS_M);
      // Normalize: assume max ~10 hotels within 200m
      const hotelScore = Math.min(hotelCount / 10, 1);

      // ── Incident density ──
      const incidentCount = queryNearby(
        incidentIdx,
        lat,
        lng,
        POI_RADIUS_M
      );
      // Normalize: assume max ~50 incidents within 200m is "high"
      const incidentScore = Math.min(incidentCount / 50, 1);

      // ── Composite base intensity (0-10) ──
      // Weights: distance=35%, commerce=30%, hotels=15%, incidents=20%
      const rawIntensity =
        distanceScore * 0.35 +
        commerceScore * 0.30 +
        hotelScore * 0.15 +
        incidentScore * 0.20;

      const baseIntensity = Math.round(rawIntensity * 10 * 100) / 100;

      // Weight for heatmap rendering (combines everything)
      // This is the base weight; the app will multiply by hourly/day factors
      const weight = Math.round(rawIntensity * 100) / 100;

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Math.round(lng * 1_000_000) / 1_000_000,
            Math.round(lat * 1_000_000) / 1_000_000,
          ],
        },
        properties: {
          baseIntensity: baseIntensity,
          commerceDensity: commerceCount,
          hotelDensity: hotelCount,
          incidentDensity: incidentCount,
          weight: weight,
        },
      });
    }
  }

  // ── Assemble GeoJSON ──────────────────────────────────────────
  const geojson = {
    type: "FeatureCollection",
    features,
    metadata: {
      gridSize: GRID_SPACING_M,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      radius: RADIUS_M,
      totalPoints: gridPointCount,
      generatedAt: new Date().toISOString(),
      hourlyMultipliers: Object.fromEntries(
        Array.from({ length: 24 }, (_, h) => [h, hourlyMultiplier(h)])
      ),
      dayMultipliers: {
        sunday: dayMultiplier(0),
        monday: dayMultiplier(1),
        saturday: dayMultiplier(6),
      },
      weights: {
        distance: 0.35,
        commerce: 0.30,
        hotels: 0.15,
        incidents: 0.20,
      },
    },
  };

  // ── Write output ──────────────────────────────────────────────
  const outPath = resolve(OUT, "pedestrian-intensity.json");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  // ── Stats ─────────────────────────────────────────────────────
  const intensities = features.map((f) => f.properties.baseIntensity);
  const avgIntensity =
    intensities.reduce((a, b) => a + b, 0) / intensities.length;
  const maxIntensity = Math.max(...intensities);
  const minIntensity = Math.min(...intensities);

  console.log(`  [pedestrian] Grid: ${gridPointCount} points`);
  console.log(
    `  [pedestrian] Intensity range: ${minIntensity.toFixed(2)} - ${maxIntensity.toFixed(2)} (avg ${avgIntensity.toFixed(2)})`
  );
  console.log(`  [pedestrian] Written to ${outPath}`);
}

// Allow direct execution
if (
  process.argv[1] &&
  (process.argv[1].endsWith("prepare-pedestrian.mjs") ||
    process.argv[1].includes("prepare-pedestrian"))
) {
  preparePedestrian().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
