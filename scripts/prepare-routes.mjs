#!/usr/bin/env node
/**
 * prepare-routes.mjs
 * Uses Google Routes API and Google Directions API to compute real
 * traffic-aware routes from key origins in Medellin to the Diamante.
 *
 * Part 1: Origin-Destination matrix (10 origins -> Diamante)
 * Part 2: Road closure simulation (Clasico Paisa scenarios)
 * Part 3: Valet walking routes from Diamante to nearby parking lots
 *
 * Output:
 *   public/data/od-routes.json
 *   public/data/closure-routes.json
 *   public/data/parking-pois.json  (enriched with walking time/distance)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

// ── Config ──────────────────────────────────────────────────────────
const API_KEY = "AIzaSyCDtpnJoftns_RXlJhDkLrLwOmdDPoQy10";
const DIAMANTE = { lat: 6.2565, lng: -75.5905 };

const ORIGINS = [
  { label: "Poblado",     lat: 6.2088, lng: -75.5667 },
  { label: "Envigado",    lat: 6.1714, lng: -75.5892 },
  { label: "Sabaneta",    lat: 6.1514, lng: -75.6164 },
  { label: "Belén",       lat: 6.2320, lng: -75.6100 },
  { label: "Centro",      lat: 6.2518, lng: -75.5636 },
  { label: "Robledo",     lat: 6.2780, lng: -75.5950 },
  { label: "Bello",       lat: 6.3380, lng: -75.5560 },
  { label: "Itagüí",      lat: 6.1850, lng: -75.5990 },
  { label: "La Estrella", lat: 6.1570, lng: -75.6300 },
  { label: "Castilla",    lat: 6.2900, lng: -75.5700 },
];

// Top-3 highest-volume origins for closure simulation
const CLOSURE_ORIGINS = ORIGINS.filter(o =>
  ["Poblado", "Centro", "Belén"].includes(o.label)
);

// Via waypoint for Clasico Paisa closure (forces via Cra 65, avoids Cra 70)
const CLOSURE_VIA = { lat: 6.2565, lng: -75.5830 };

// ── Polyline decoder ────────────────────────────────────────────────
function decodePolyline(str) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

// ── Helpers ─────────────────────────────────────────────────────────
function parseDuration(durationStr) {
  // Google returns "123s" format
  if (!durationStr) return 0;
  return parseInt(durationStr.replace("s", ""), 10) || 0;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}min`;
  }
  return `${m}min ${s}s`;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Part 1: OD Routes via Google Routes API ─────────────────────────
async function computeODRoutes() {
  console.log("\n=== Part 1: Origin-Destination Routes ===");
  const results = [];

  for (const origin of ORIGINS) {
    console.log(`  [routes] ${origin.label} -> Diamante ...`);

    const body = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: DIAMANTE.lat, longitude: DIAMANTE.lng },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: true,
    };

    try {
      const resp = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask":
              "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.polyline.encodedPolyline,routes.routeLabels",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`    ERROR ${resp.status}: ${errText}`);
        continue;
      }

      const data = await resp.json();
      const routes = (data.routes || []).map((route, idx) => {
        const durationSec = parseDuration(route.duration);
        const distanceM = route.distanceMeters || 0;
        const encoded = route.polyline?.encodedPolyline || "";
        const coordinates = encoded ? decodePolyline(encoded) : [];

        // Determine label from routeLabels
        const labels = route.routeLabels || [];
        let label = "alternative";
        if (labels.includes("DEFAULT_ROUTE") || idx === 0) label = "fastest";

        return {
          index: idx,
          distance: distanceM,
          duration: durationSec,
          durationText: formatDuration(durationSec),
          coordinates,
          label,
        };
      });

      results.push({
        origin: origin.label,
        originLat: origin.lat,
        originLng: origin.lng,
        routes,
      });

      const fastest = routes[0];
      console.log(
        `    ${routes.length} route(s) | fastest: ${(fastest.distance / 1000).toFixed(1)} km, ${fastest.durationText}`
      );
    } catch (err) {
      console.error(`    FETCH ERROR for ${origin.label}: ${err.message}`);
    }

    // Rate-limit: small delay between requests
    await sleep(300);
  }

  return results;
}

// ── Part 2: Closure Routes via Google Directions API ────────────────
async function computeClosureRoutes() {
  console.log("\n=== Part 2: Closure Simulation Routes ===");
  const results = [];

  for (const origin of CLOSURE_ORIGINS) {
    // Scenario 1: Normal route (no avoidance)
    console.log(`  [closure] ${origin.label} -> Diamante (normal) ...`);
    try {
      const normalUrl = new URL(
        "https://maps.googleapis.com/maps/api/directions/json"
      );
      normalUrl.searchParams.set("origin", `${origin.lat},${origin.lng}`);
      normalUrl.searchParams.set(
        "destination",
        `${DIAMANTE.lat},${DIAMANTE.lng}`
      );
      normalUrl.searchParams.set("alternatives", "true");
      normalUrl.searchParams.set("key", API_KEY);

      const resp = await fetch(normalUrl.toString(), {
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        console.error(`    ERROR ${resp.status}`);
      } else {
        const data = await resp.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          const encoded = route.overview_polyline?.points || "";
          results.push({
            origin: origin.label,
            scenario: "normal",
            distance: leg.distance?.value || 0,
            duration: leg.duration?.value || 0,
            durationText: leg.duration?.text || "",
            coordinates: encoded ? decodePolyline(encoded) : [],
          });
          console.log(
            `    normal: ${leg.distance?.text}, ${leg.duration?.text}`
          );
        }
      }
    } catch (err) {
      console.error(`    FETCH ERROR (normal) ${origin.label}: ${err.message}`);
    }

    await sleep(300);

    // Scenario 2: Clasico Paisa closure — waypoint via Cra 65
    console.log(
      `  [closure] ${origin.label} -> Diamante (clasico_closure via Cra 65) ...`
    );
    try {
      const closureUrl = new URL(
        "https://maps.googleapis.com/maps/api/directions/json"
      );
      closureUrl.searchParams.set("origin", `${origin.lat},${origin.lng}`);
      closureUrl.searchParams.set(
        "destination",
        `${DIAMANTE.lat},${DIAMANTE.lng}`
      );
      closureUrl.searchParams.set(
        "waypoints",
        `via:${CLOSURE_VIA.lat},${CLOSURE_VIA.lng}`
      );
      closureUrl.searchParams.set("alternatives", "false");
      closureUrl.searchParams.set("key", API_KEY);

      const resp = await fetch(closureUrl.toString(), {
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        console.error(`    ERROR ${resp.status}`);
      } else {
        const data = await resp.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          const encoded = route.overview_polyline?.points || "";

          // Sum up all legs (waypoints split into multiple legs)
          let totalDistance = 0;
          let totalDuration = 0;
          for (const l of route.legs) {
            totalDistance += l.distance?.value || 0;
            totalDuration += l.duration?.value || 0;
          }

          results.push({
            origin: origin.label,
            scenario: "clasico_closure",
            distance: totalDistance,
            duration: totalDuration,
            durationText: formatDuration(totalDuration),
            coordinates: encoded ? decodePolyline(encoded) : [],
          });
          console.log(
            `    closure: ${(totalDistance / 1000).toFixed(1)} km, ${formatDuration(totalDuration)}`
          );
        }
      }
    } catch (err) {
      console.error(
        `    FETCH ERROR (closure) ${origin.label}: ${err.message}`
      );
    }

    await sleep(300);
  }

  return results;
}

// ── Part 3: Valet Walking Routes ────────────────────────────────────
async function computeWalkingRoutes() {
  console.log("\n=== Part 3: Valet Walking Routes ===");

  const parkingPath = resolve(OUT, "parking-pois.json");
  let parkingData;
  try {
    parkingData = JSON.parse(readFileSync(parkingPath, "utf8"));
  } catch (err) {
    console.error(`  [walking] Cannot read parking-pois.json: ${err.message}`);
    return null;
  }

  // The parking data is a flat JSON array of objects
  const parkingList = Array.isArray(parkingData) ? parkingData : [];
  if (parkingList.length === 0) {
    console.error("  [walking] No parking entries found in parking-pois.json");
    return null;
  }

  console.log(`  [walking] ${parkingList.length} parking lots to process`);

  let enrichedCount = 0;
  for (let i = 0; i < parkingList.length; i++) {
    const p = parkingList[i];
    const pLat = p.lat;
    const pLng = p.lng;

    if (!pLat || !pLng) {
      console.log(`  [walking] Skipping ${p.id || i} — no coordinates`);
      continue;
    }

    console.log(
      `  [walking] (${i + 1}/${parkingList.length}) ${p.name || p.id} ...`
    );

    try {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/directions/json"
      );
      url.searchParams.set(
        "origin",
        `${DIAMANTE.lat},${DIAMANTE.lng}`
      );
      url.searchParams.set("destination", `${pLat},${pLng}`);
      url.searchParams.set("mode", "walking");
      url.searchParams.set("key", API_KEY);

      const resp = await fetch(url.toString(), {
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        console.error(`    ERROR ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      if (data.routes && data.routes.length > 0) {
        const leg = data.routes[0].legs[0];
        p.walkingTimeSeconds = leg.duration?.value || null;
        p.walkingDistanceMeters = leg.distance?.value || null;
        enrichedCount++;
        console.log(
          `    ${leg.distance?.text}, ${leg.duration?.text}`
        );
      } else {
        console.log(`    No walking route found`);
        p.walkingTimeSeconds = null;
        p.walkingDistanceMeters = null;
      }
    } catch (err) {
      console.error(`    FETCH ERROR: ${err.message}`);
      p.walkingTimeSeconds = null;
      p.walkingDistanceMeters = null;
    }

    // Rate-limit
    await sleep(200);
  }

  console.log(
    `  [walking] Enriched ${enrichedCount}/${parkingList.length} parking lots`
  );
  return parkingList;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("prepare-routes.mjs — Google Routes & Directions API");
  console.log(`API Key: ${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)}`);
  console.log(`Destination (Diamante): ${DIAMANTE.lat}, ${DIAMANTE.lng}\n`);

  // Part 1: OD Routes
  const odRoutes = await computeODRoutes();
  const odPath = resolve(OUT, "od-routes.json");
  writeFileSync(odPath, JSON.stringify(odRoutes, null, 2));
  console.log(`\n  Wrote ${odPath}`);
  console.log(`  Total OD entries: ${odRoutes.length}`);
  const totalRoutes = odRoutes.reduce((s, od) => s + od.routes.length, 0);
  console.log(`  Total route variants: ${totalRoutes}`);

  // Part 2: Closure Routes
  const closureRoutes = await computeClosureRoutes();
  const closurePath = resolve(OUT, "closure-routes.json");
  writeFileSync(closurePath, JSON.stringify(closureRoutes, null, 2));
  console.log(`\n  Wrote ${closurePath}`);
  console.log(`  Total closure scenarios: ${closureRoutes.length}`);

  // Part 3: Walking Routes + enrich parking
  const enrichedParking = await computeWalkingRoutes();
  if (enrichedParking) {
    const parkingPath = resolve(OUT, "parking-pois.json");
    writeFileSync(parkingPath, JSON.stringify(enrichedParking, null, 2));
    console.log(`\n  Wrote enriched ${parkingPath}`);
  }

  // ── Summary stats ───────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("══════════════════════════════════════════════════");

  if (odRoutes.length > 0) {
    console.log("\n  OD Routes:");
    for (const od of odRoutes) {
      if (od.routes.length === 0) continue;
      const fastest = od.routes[0];
      console.log(
        `    ${od.origin.padEnd(14)} → ${(fastest.distance / 1000).toFixed(1).padStart(6)} km | ${fastest.durationText.padStart(12)} | ${od.routes.length} variant(s)`
      );
    }
    const allDistances = odRoutes.flatMap(od =>
      od.routes.map(r => r.distance)
    );
    const allDurations = odRoutes.flatMap(od =>
      od.routes.map(r => r.duration)
    );
    if (allDistances.length > 0) {
      console.log(
        `\n    Avg distance: ${(allDistances.reduce((a, b) => a + b, 0) / allDistances.length / 1000).toFixed(1)} km`
      );
      console.log(
        `    Avg duration: ${formatDuration(Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length))}`
      );
      console.log(
        `    Min distance: ${(Math.min(...allDistances) / 1000).toFixed(1)} km`
      );
      console.log(
        `    Max distance: ${(Math.max(...allDistances) / 1000).toFixed(1)} km`
      );
    }
  }

  if (closureRoutes.length > 0) {
    console.log("\n  Closure Scenarios:");
    for (const cr of closureRoutes) {
      console.log(
        `    ${cr.origin.padEnd(14)} [${cr.scenario.padEnd(16)}] → ${(cr.distance / 1000).toFixed(1).padStart(6)} km | ${cr.durationText.padStart(12)}`
      );
    }

    // Compare normal vs closure for same origin
    const byOrigin = {};
    for (const cr of closureRoutes) {
      if (!byOrigin[cr.origin]) byOrigin[cr.origin] = {};
      byOrigin[cr.origin][cr.scenario] = cr;
    }
    console.log("\n  Closure Impact:");
    for (const [orig, scenarios] of Object.entries(byOrigin)) {
      if (scenarios.normal && scenarios.clasico_closure) {
        const diff = scenarios.clasico_closure.duration - scenarios.normal.duration;
        const pct = ((diff / scenarios.normal.duration) * 100).toFixed(1);
        const distDiff =
          scenarios.clasico_closure.distance - scenarios.normal.distance;
        console.log(
          `    ${orig.padEnd(14)}: +${formatDuration(Math.abs(diff))} (${pct}%) | +${(distDiff / 1000).toFixed(1)} km`
        );
      }
    }
  }

  if (enrichedParking) {
    const withWalking = enrichedParking.filter(
      p => p.walkingTimeSeconds != null
    );
    if (withWalking.length > 0) {
      console.log("\n  Walking Routes (Diamante -> Parking):");
      const times = withWalking.map(p => p.walkingTimeSeconds);
      const dists = withWalking.map(p => p.walkingDistanceMeters);
      console.log(`    Parking lots enriched: ${withWalking.length}`);
      console.log(
        `    Avg walking time:     ${formatDuration(Math.round(times.reduce((a, b) => a + b, 0) / times.length))}`
      );
      console.log(
        `    Min walking time:     ${formatDuration(Math.min(...times))}`
      );
      console.log(
        `    Max walking time:     ${formatDuration(Math.max(...times))}`
      );
      console.log(
        `    Avg walking distance: ${Math.round(dists.reduce((a, b) => a + b, 0) / dists.length)} m`
      );
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
