#!/usr/bin/env node
/**
 * prepare-google-places.mjs
 * Fetches real POI data from Google Places API (New) around the
 * Diamante de Béisbol de Medellín.
 *
 * Outputs:
 *   public/data/parking-pois.json
 *   public/data/commerce-pois.json
 *   public/data/hotels-pois.json
 *   public/data/sports-venues.json
 *   public/data/attractions-pois.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

/* ── Config ─────────────────────────────────────────────────────────── */

const API_KEY = "AIzaSyCDtpnJoftns_RXlJhDkLrLwOmdDPoQy10";
const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const CENTER = { lat: 6.2565, lng: -75.5905 };

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.formattedAddress",
  "places.regularOpeningHours",
  "places.nationalPhoneNumber",
  "places.websiteUri",
].join(",");

const HEADERS = {
  "Content-Type": "application/json",
  "X-Goog-Api-Key": API_KEY,
  "X-Goog-FieldMask": FIELD_MASK,
};

/* ── Category definitions ───────────────────────────────────────────── */

const QUERIES = [
  // Parking
  { type: "parking", radius: 1000, target: "parking" },
  // Commerce — high-density categories get multi-radius queries
  { type: "restaurant", radius: 500, target: "commerce" },
  { type: "restaurant", radius: 1000, target: "commerce" },
  { type: "cafe", radius: 500, target: "commerce" },
  { type: "cafe", radius: 1000, target: "commerce" },
  { type: "bar", radius: 500, target: "commerce" },
  { type: "bar", radius: 1000, target: "commerce" },
  { type: "fast_food_restaurant", radius: 500, target: "commerce" },
  { type: "fast_food_restaurant", radius: 1000, target: "commerce" },
  { type: "bank", radius: 1000, target: "commerce" },
  { type: "pharmacy", radius: 1000, target: "commerce" },
  { type: "shopping_mall", radius: 1000, target: "commerce" },
  { type: "supermarket", radius: 1000, target: "commerce" },
  { type: "spa", radius: 1500, target: "commerce" },
  { type: "beauty_salon", radius: 1500, target: "commerce" },
  { type: "bakery", radius: 1000, target: "commerce" },
  { type: "convenience_store", radius: 1000, target: "commerce" },
  { type: "clothing_store", radius: 1000, target: "commerce" },
  // Hotels
  { type: "hotel", radius: 1500, target: "hotels" },
  { type: "hostel", radius: 1500, target: "hotels" },
  { type: "lodging", radius: 1500, target: "hotels" },
  // Sports
  { type: "gym", radius: 1500, target: "sports" },
  { type: "sports_complex", radius: 1500, target: "sports" },
  { type: "stadium", radius: 1500, target: "sports" },
  { type: "fitness_center", radius: 1500, target: "sports" },
  // Attractions
  { type: "tourist_attraction", radius: 1500, target: "attractions" },
  { type: "museum", radius: 1500, target: "attractions" },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Haversine distance in meters */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Map Google primaryType → human-readable category */
function mapCategory(primaryType, types) {
  const t = primaryType || (types && types[0]) || "unknown";
  const map = {
    restaurant: "restaurant",
    cafe: "cafe",
    bar: "bar",
    fast_food_restaurant: "fast_food",
    bank: "bank",
    pharmacy: "pharmacy",
    shopping_mall: "shopping_mall",
    supermarket: "supermarket",
    spa: "spa",
    beauty_salon: "beauty_salon",
    bakery: "bakery",
    convenience_store: "convenience_store",
    clothing_store: "clothing_store",
    hotel: "hotel",
    hostel: "hostel",
    lodging: "lodging",
    gym: "gym",
    sports_complex: "sports_complex",
    stadium: "stadium",
    fitness_center: "fitness_center",
    tourist_attraction: "tourist_attraction",
    museum: "museum",
    parking: "parking",
  };
  return map[t] || t;
}

/** Map Google priceLevel enum to string */
function mapPriceLevel(pl) {
  if (!pl) return null;
  const map = {
    PRICE_LEVEL_FREE: "free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[pl] || pl;
}

/* ── Parking estimation logic ───────────────────────────────────────── */

function estimateParkingType(name, types) {
  const n = (name || "").toLowerCase();
  const t = (types || []).map((s) => s.toLowerCase());
  if (
    n.includes("edificio") ||
    n.includes("torre") ||
    n.includes("cubierto") ||
    t.includes("parking_garage")
  ) {
    return "building";
  }
  if (n.includes("subterráneo") || n.includes("subterraneo")) {
    return "underground";
  }
  if (n.includes("multinivel") || n.includes("multi")) {
    return "multi-storey";
  }
  return "surface";
}

function estimateCapacity(name, types, parkingType) {
  const n = (name || "").toLowerCase();
  if (
    n.includes("edificio") ||
    n.includes("torre") ||
    n.includes("cubierto")
  ) {
    return 60 + Math.floor(Math.random() * 41); // 60-100
  }
  if (types && types.includes("parking_garage")) {
    return 80;
  }
  if (n.includes("público") || n.includes("publico")) {
    // Near stadium area
    return 40 + Math.floor(Math.random() * 21); // 40-60
  }
  return 25;
}

function estimateTariff(lat, lng) {
  const distToStadium = haversine(lat, lng, CENTER.lat, CENTER.lng);
  if (distToStadium <= 500) {
    return { tarifaMin: 5000, tarifaMax: 10000 };
  }
  return { tarifaMin: 4000, tarifaMax: 8000 };
}

/* ── API call with pagination ───────────────────────────────────────── */

async function searchNearby(includedType, radius) {
  const results = [];
  let pageToken = null;
  let page = 0;

  do {
    const body = {
      includedTypes: [includedType],
      locationRestriction: {
        circle: {
          center: { latitude: CENTER.lat, longitude: CENTER.lng },
          radius: radius,
        },
      },
      maxResultCount: 20,
      rankPreference: "DISTANCE",
    };
    if (pageToken) {
      body.pageToken = pageToken;
    }

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(
        `  [ERROR] ${includedType} r=${radius} page=${page}: HTTP ${resp.status} — ${errText.slice(0, 200)}`
      );
      break;
    }

    const data = await resp.json();
    const places = data.places || [];
    results.push(...places);
    pageToken = data.nextPageToken || null;
    page++;

    console.log(
      `  ${includedType} r=${radius} page=${page}: ${places.length} results${pageToken ? " (more pages)" : ""}`
    );

    // Respect rate limits
    if (pageToken) await sleep(300);
  } while (pageToken && page < 5); // safety cap at 5 pages

  return results;
}

/* ── Transform functions ────────────────────────────────────────────── */

function toCommercePOI(place) {
  const loc = place.location || {};
  return {
    id: place.id,
    name: place.displayName?.text || "Sin nombre",
    lat: loc.latitude || 0,
    lng: loc.longitude || 0,
    category: mapCategory(place.primaryType, place.types),
    subcategory: place.primaryType || place.types?.[0] || "unknown",
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount || 0,
    priceLevel: mapPriceLevel(place.priceLevel) || null,
    address: place.formattedAddress || "",
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions || [],
  };
}

function toParkingPOI(place) {
  const loc = place.location || {};
  const lat = loc.latitude || 0;
  const lng = loc.longitude || 0;
  const name = place.displayName?.text || "Parqueadero";
  const types = place.types || [];
  const parkingType = estimateParkingType(name, types);
  const capacity = estimateCapacity(name, types, parkingType);
  const { tarifaMin, tarifaMax } = estimateTariff(lat, lng);

  return {
    id: place.id,
    name,
    lat,
    lng,
    capacity,
    tarifaMin,
    tarifaMax,
    type: parkingType,
    source: "google",
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount || 0,
    address: place.formattedAddress || "",
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions || [],
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
  };
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  console.log("=== Google Places API (New) — Diamante de Béisbol ===\n");

  // Accumulate raw results per target, deduplicating by Place ID
  const buckets = {
    parking: new Map(),
    commerce: new Map(),
    hotels: new Map(),
    sports: new Map(),
    attractions: new Map(),
  };

  // Track counts per query type for summary
  const typeCounts = {};

  for (const q of QUERIES) {
    console.log(`Querying: ${q.type} (radius=${q.radius}m) → ${q.target}`);
    try {
      const places = await searchNearby(q.type, q.radius);
      let newCount = 0;
      for (const p of places) {
        if (!buckets[q.target].has(p.id)) {
          buckets[q.target].set(p.id, p);
          newCount++;
        }
      }
      typeCounts[q.type] = (typeCounts[q.type] || 0) + newCount;
      console.log(
        `  → ${places.length} fetched, ${newCount} new (total ${buckets[q.target].size} in ${q.target})\n`
      );
    } catch (err) {
      console.error(`  [FAIL] ${q.type}: ${err.message}\n`);
    }
    // Rate-limit between queries
    await sleep(200);
  }

  // ── Transform & write ────────────────────────────────────────────
  const parkingPOIs = [...buckets.parking.values()].map(toParkingPOI);
  const commercePOIs = [...buckets.commerce.values()].map(toCommercePOI);
  const hotelsPOIs = [...buckets.hotels.values()].map(toCommercePOI);
  const sportsPOIs = [...buckets.sports.values()].map(toCommercePOI);
  const attractionsPOIs = [...buckets.attractions.values()].map(toCommercePOI);

  const outputs = [
    { file: "parking-pois.json", data: parkingPOIs },
    { file: "commerce-pois.json", data: commercePOIs },
    { file: "hotels-pois.json", data: hotelsPOIs },
    { file: "sports-venues.json", data: sportsPOIs },
    { file: "attractions-pois.json", data: attractionsPOIs },
  ];

  console.log("\n=== Writing output files ===\n");

  for (const { file, data } of outputs) {
    const path = resolve(OUT, file);
    const json = JSON.stringify(data, null, 2);
    writeFileSync(path, json, "utf-8");
    const sizeKB = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);
    console.log(`${file}: ${data.length} POIs (${sizeKB} KB)`);
  }

  // ── Summary by type ──────────────────────────────────────────────
  console.log("\n=== Per-type POI counts (deduplicated) ===\n");
  for (const [type, count] of Object.entries(typeCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }

  const total =
    parkingPOIs.length +
    commercePOIs.length +
    hotelsPOIs.length +
    sportsPOIs.length +
    attractionsPOIs.length;
  console.log(`\nTotal unique POIs: ${total}`);
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
