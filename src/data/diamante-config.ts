import type { BBox, GeoPoint } from "@/types";

export const DIAMANTE_CENTER: GeoPoint = {
  lat: 6.2565,
  lng: -75.5905,
};

export const DIAMANTE_BBOX: BBox = {
  north: 6.268,
  south: 6.245,
  east: -75.578,
  west: -75.600,
};

export const MAP_DEFAULT_ZOOM = 14.5;

export const MAP_STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

export type MapStyleId = keyof typeof MAP_STYLES;

export const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  streets: "Calles",
  satellite: "Satélite",
  light: "Claro",
  dark: "Oscuro",
};

export const MAP_STYLE = MAP_STYLES.satellite;

// Diamante polygon (approximate footprint)
export const DIAMANTE_POLYGON: [number, number][] = [
  [-75.5915, 6.2555],
  [-75.5895, 6.2555],
  [-75.5893, 6.2575],
  [-75.5913, 6.2575],
  [-75.5915, 6.2555],
];

export const DIAMANTE_HEIGHT = 25; // meters (2 underground + ground level)

// Impact radii (meters)
export const IMPACT_RADII = [500, 1000, 1500];

// Atanasio Girardot stadium reference
export const ATANASIO_CENTER: GeoPoint = {
  lat: 6.2563,
  lng: -75.5907,
};

export const ATANASIO_CAPACITY = 45_000;
