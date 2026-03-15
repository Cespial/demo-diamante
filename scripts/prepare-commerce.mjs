#!/usr/bin/env node
/**
 * prepare-commerce.mjs
 * Fetches commerce, hotel, and sports POIs from Overpass API.
 * Falls back to synthetic data on failure.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const CENTER = { lat: 6.2565, lon: -75.5905 };
const RADIUS = 1500;

async function fetchOverpass(query) {
  const url = "https://overpass-api.de/api/interpreter";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  const data = await resp.json();
  return data.elements || [];
}

function toFeature(el, category) {
  const lat = el.lat || el.center?.lat;
  const lon = el.lon || el.center?.lon;
  if (!lat || !lon) return null;
  const tags = el.tags || {};
  return {
    type: "Feature",
    properties: {
      id: `osm-${el.type}-${el.id}`,
      name: tags.name || tags["name:es"] || category,
      category,
      amenity: tags.amenity || tags.tourism || tags.shop || tags.leisure || null,
      cuisine: tags.cuisine || null,
      stars: tags.stars ? parseInt(tags.stars, 10) : null,
      rooms: tags.rooms ? parseInt(tags.rooms, 10) : null,
      phone: tags.phone || tags["contact:phone"] || null,
      website: tags.website || tags["contact:website"] || null,
      source: "osm",
    },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

// ── Commerce query ──
const COMMERCE_QUERY = `
[out:json][timeout:45];
(
  node["amenity"~"restaurant|cafe|bar|fast_food|bank|pharmacy|clinic"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["amenity"~"restaurant|cafe|bar|fast_food|bank|pharmacy|clinic"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  node["shop"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["shop"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
);
out center body;
`;

// ── Hotels query ──
const HOTEL_QUERY = `
[out:json][timeout:30];
(
  node["tourism"~"hotel|hostel|guest_house|motel"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["tourism"~"hotel|hostel|guest_house|motel"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
);
out center body;
`;

// ── Sports query ──
const SPORTS_QUERY = `
[out:json][timeout:30];
(
  node["leisure"~"sports_centre|fitness_centre|stadium|pitch"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["leisure"~"sports_centre|fitness_centre|stadium|pitch"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  node["amenity"="sports_centre"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
  way["amenity"="sports_centre"](around:${RADIUS},${CENTER.lat},${CENTER.lon});
);
out center body;
`;

function categorize(el) {
  const tags = el.tags || {};
  if (tags.tourism) return tags.tourism;
  if (tags.leisure) return tags.leisure;
  if (tags.amenity) return tags.amenity;
  if (tags.shop) return `shop-${tags.shop}`;
  return "other";
}

// ── Synthetic fallbacks ──
function syntheticCommerce() {
  const pois = [
    { name: "Restaurante Mondongos", cat: "restaurant", lat: 6.2580, lon: -75.5918 },
    { name: "Hacienda Real", cat: "restaurant", lat: 6.2575, lon: -75.5922 },
    { name: "Juan Valdez Cafe Laureles", cat: "cafe", lat: 6.2572, lon: -75.5915 },
    { name: "Starbucks Unicentro", cat: "cafe", lat: 6.2588, lon: -75.5863 },
    { name: "Pergamino Cafe", cat: "cafe", lat: 6.2583, lon: -75.5925 },
    { name: "BBC Cerveceria Laureles", cat: "bar", lat: 6.2578, lon: -75.5930 },
    { name: "El Social", cat: "bar", lat: 6.2576, lon: -75.5932 },
    { name: "McDonald's San Juan", cat: "fast_food", lat: 6.2577, lon: -75.5880 },
    { name: "Subway Circular", cat: "fast_food", lat: 6.2555, lon: -75.5895 },
    { name: "Bancolombia Laureles", cat: "bank", lat: 6.2570, lon: -75.5912 },
    { name: "Davivienda Cra 70", cat: "bank", lat: 6.2565, lon: -75.5878 },
    { name: "Drogueria La Rebaja", cat: "pharmacy", lat: 6.2568, lon: -75.5910 },
    { name: "Farmatodo Laureles", cat: "pharmacy", lat: 6.2582, lon: -75.5920 },
    { name: "CES Clinica", cat: "clinic", lat: 6.2548, lon: -75.5860 },
    { name: "Exito Laureles", cat: "shop-supermarket", lat: 6.2590, lon: -75.5928 },
    { name: "D1 Circular 3", cat: "shop-convenience", lat: 6.2550, lon: -75.5898 },
    { name: "Panamericana Unicentro", cat: "shop-books", lat: 6.2586, lon: -75.5865 },
    { name: "Alkosto San Juan", cat: "shop-electronics", lat: 6.2578, lon: -75.5960 },
    { name: "Ara Estadio", cat: "shop-convenience", lat: 6.2558, lon: -75.5875 },
    { name: "Rappi Market Laureles", cat: "shop-convenience", lat: 6.2573, lon: -75.5908 },
    { name: "Panaderia El Horno", cat: "shop-bakery", lat: 6.2560, lon: -75.5915 },
    { name: "Carulla San Juan", cat: "shop-supermarket", lat: 6.2575, lon: -75.5870 },
    { name: "Drogueria Pasteur", cat: "pharmacy", lat: 6.2562, lon: -75.5900 },
    { name: "Crepes & Waffles Oviedo", cat: "restaurant", lat: 6.2608, lon: -75.5843 },
    { name: "Il Forno Laureles", cat: "restaurant", lat: 6.2585, lon: -75.5925 },
  ];
  return pois.map((p, i) => ({
    type: "Feature",
    properties: { id: `syn-com-${i + 1}`, name: p.name, category: p.cat, amenity: p.cat, source: "synthetic" },
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
  }));
}

function syntheticHotels() {
  const hotels = [
    { name: "Hotel Dann Carlton Medellín", cat: "hotel", lat: 6.2575, lon: -75.5855, stars: 5, rooms: 230 },
    { name: "Hotel Intercontinental", cat: "hotel", lat: 6.2560, lon: -75.5845, stars: 5, rooms: 290 },
    { name: "Hotel Nutibara", cat: "hotel", lat: 6.2510, lon: -75.5840, stars: 4, rooms: 180 },
    { name: "Selina Medellín", cat: "hostel", lat: 6.2582, lon: -75.5928, stars: null, rooms: 45 },
    { name: "Viajero Hostel Laureles", cat: "hostel", lat: 6.2588, lon: -75.5935, stars: null, rooms: 30 },
    { name: "Los Patios Hostel", cat: "hostel", lat: 6.2592, lon: -75.5940, stars: null, rooms: 25 },
    { name: "Hotel Poblado Alejandria", cat: "hotel", lat: 6.2535, lon: -75.5875, stars: 3, rooms: 60 },
    { name: "Hampton by Hilton Laureles", cat: "hotel", lat: 6.2570, lon: -75.5910, stars: 4, rooms: 140 },
    { name: "Medellin Marriott Hotel", cat: "hotel", lat: 6.2598, lon: -75.5850, stars: 5, rooms: 170 },
    { name: "Rango Hostel", cat: "hostel", lat: 6.2585, lon: -75.5932, stars: null, rooms: 20 },
    { name: "Hotel Laureles Estadio", cat: "hotel", lat: 6.2558, lon: -75.5898, stars: 3, rooms: 55 },
    { name: "Hotel San Fernando Plaza", cat: "hotel", lat: 6.2545, lon: -75.5865, stars: 4, rooms: 160 },
  ];
  return hotels.map((h, i) => ({
    type: "Feature",
    properties: {
      id: `syn-hotel-${i + 1}`, name: h.name, category: h.cat,
      amenity: h.cat, stars: h.stars, rooms: h.rooms, source: "synthetic",
    },
    geometry: { type: "Point", coordinates: [h.lon, h.lat] },
  }));
}

function syntheticSports() {
  const venues = [
    { name: "Estadio Atanasio Girardot", cat: "stadium", lat: 6.2558, lon: -75.5890, capacity: 40943 },
    { name: "Diamante de Beisbol", cat: "stadium", lat: 6.2565, lon: -75.5905, capacity: 3500 },
    { name: "Coliseo Ivan de Bedout", cat: "sports_centre", lat: 6.2548, lon: -75.5885, capacity: 5000 },
    { name: "Coliseo Yesid Santos", cat: "sports_centre", lat: 6.2550, lon: -75.5895, capacity: 3000 },
    { name: "Piscina Olímpica Atanasio", cat: "sports_centre", lat: 6.2545, lon: -75.5892, capacity: 2000 },
    { name: "Velódromo Martín Emilio Cochise Rodríguez", cat: "sports_centre", lat: 6.2540, lon: -75.5888, capacity: 3000 },
    { name: "Patinódromo", cat: "sports_centre", lat: 6.2538, lon: -75.5895, capacity: 1500 },
    { name: "Coliseo de Combate", cat: "sports_centre", lat: 6.2542, lon: -75.5900, capacity: 2000 },
    { name: "Bodytech Laureles", cat: "fitness_centre", lat: 6.2580, lon: -75.5915, capacity: null },
    { name: "Smart Fit Unicentro", cat: "fitness_centre", lat: 6.2585, lon: -75.5862, capacity: null },
    { name: "Cancha Sintética La 70", cat: "pitch", lat: 6.2572, lon: -75.5882, capacity: null },
    { name: "Club El Rodeo", cat: "sports_centre", lat: 6.2545, lon: -75.5935, capacity: null },
  ];
  return venues.map((v, i) => ({
    type: "Feature",
    properties: {
      id: `syn-sport-${i + 1}`, name: v.name, category: v.cat,
      leisure: v.cat, capacity: v.capacity, source: "synthetic",
    },
    geometry: { type: "Point", coordinates: [v.lon, v.lat] },
  }));
}

export default async function prepareCommerce() {
  let commerceFeatures, hotelFeatures, sportsFeatures;

  // ── Commerce ──
  try {
    console.log("  [commerce] Fetching commerce from Overpass...");
    const els = await fetchOverpass(COMMERCE_QUERY);
    if (els.length === 0) throw new Error("No results");
    commerceFeatures = els.map((e) => toFeature(e, categorize(e))).filter(Boolean);
    console.log(`  [commerce] Got ${commerceFeatures.length} commerce POIs from OSM`);
  } catch (err) {
    console.log(`  [commerce] Overpass failed (${err.message}), using synthetic...`);
    commerceFeatures = syntheticCommerce();
  }

  // ── Hotels ──
  try {
    console.log("  [commerce] Fetching hotels from Overpass...");
    const els = await fetchOverpass(HOTEL_QUERY);
    if (els.length === 0) throw new Error("No results");
    hotelFeatures = els.map((e) => toFeature(e, categorize(e))).filter(Boolean);
    console.log(`  [commerce] Got ${hotelFeatures.length} hotel POIs from OSM`);
  } catch (err) {
    console.log(`  [commerce] Hotels overpass failed (${err.message}), using synthetic...`);
    hotelFeatures = syntheticHotels();
  }

  // ── Sports ──
  try {
    console.log("  [commerce] Fetching sports venues from Overpass...");
    const els = await fetchOverpass(SPORTS_QUERY);
    if (els.length === 0) throw new Error("No results");
    sportsFeatures = els.map((e) => toFeature(e, categorize(e))).filter(Boolean);
    console.log(`  [commerce] Got ${sportsFeatures.length} sports POIs from OSM`);
  } catch (err) {
    console.log(`  [commerce] Sports overpass failed (${err.message}), using synthetic...`);
    sportsFeatures = syntheticSports();
  }

  const wrap = (features, src) => ({
    type: "FeatureCollection",
    metadata: { source: src, generated: new Date().toISOString(), center: CENTER, radius_m: RADIUS },
    features,
  });

  const commSrc = commerceFeatures[0]?.properties?.source || "mixed";
  const hotelSrc = hotelFeatures[0]?.properties?.source || "mixed";
  const sportSrc = sportsFeatures[0]?.properties?.source || "mixed";

  writeFileSync(resolve(OUT, "commerce-pois.json"), JSON.stringify(wrap(commerceFeatures, commSrc)));
  writeFileSync(resolve(OUT, "hotels-pois.json"), JSON.stringify(wrap(hotelFeatures, hotelSrc)));
  writeFileSync(resolve(OUT, "sports-venues.json"), JSON.stringify(wrap(sportsFeatures, sportSrc)));

  console.log(`  [commerce] Wrote commerce-pois.json (${commerceFeatures.length})`);
  console.log(`  [commerce] Wrote hotels-pois.json (${hotelFeatures.length})`);
  console.log(`  [commerce] Wrote sports-venues.json (${sportsFeatures.length})`);
}

if (process.argv[1] && process.argv[1].endsWith("prepare-commerce.mjs")) {
  prepareCommerce().catch(console.error);
}
