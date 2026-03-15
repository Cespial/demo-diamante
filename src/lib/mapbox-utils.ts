import type { Scenario } from "@/types";
import { DIAMANTE_POLYGON, DIAMANTE_HEIGHT } from "@/data/diamante-config";
import { gaussian } from "./utils";

export function getDiamanteSource(): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      name: "Diamante de Béisbol",
      height: DIAMANTE_HEIGHT,
    },
    geometry: {
      type: "Polygon",
      coordinates: [DIAMANTE_POLYGON],
    },
  };
}

export function getImpactRadiiSource(
  center: [number, number],
  radii: number[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: radii.map((r) => ({
      type: "Feature" as const,
      properties: { radius: r, label: `${r}m` },
      geometry: {
        type: "Point",
        coordinates: center,
      },
    })),
  };
}

/**
 * Generate heatmap intensity weights based on scenario and hour
 */
export function getHeatmapIntensity(
  scenario: Scenario,
  hour: number
): number {
  if (scenario.id === "normal") {
    return 0.3 + 0.4 * gaussian(hour, 18, 3);
  }
  return (
    0.3 +
    (scenario.attendance / 10_000) *
      0.15 *
      gaussian(hour, scenario.peakHour, scenario.peakSpread)
  );
}

/**
 * Traffic line color based on speed
 */
export function speedToColor(speed: number): string {
  if (speed >= 40) return "#22c55e"; // green — free flow
  if (speed >= 25) return "#eab308"; // yellow — moderate
  if (speed >= 15) return "#f97316"; // orange — slow
  return "#ef4444"; // red — congested
}

/**
 * Traffic line width based on volume
 */
export function volumeToWidth(volume: number, maxVolume: number): number {
  return 2 + (volume / maxVolume) * 8;
}
