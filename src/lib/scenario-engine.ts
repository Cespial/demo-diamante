import type { HourlyVolume, Scenario } from "@/types";
import { SCENARIOS } from "@/data/scenarios";
import { gaussian, clamp } from "./utils";

/**
 * Apply scenario multipliers to base traffic volume at a given hour.
 */
export function applyScenarioToTraffic(
  baseVolume: HourlyVolume,
  scenario: Scenario,
  hour: number
): HourlyVolume {
  const eventFactor =
    scenario.id === "normal"
      ? 1
      : 1 +
        (scenario.vehicleMultiplier - 1) *
          gaussian(hour, scenario.peakHour, scenario.peakSpread);

  const mult = clamp(eventFactor, 1, scenario.vehicleMultiplier);

  // Speed decreases as volume increases
  const speedFactor = 1 / Math.sqrt(mult);

  return {
    hour,
    autos: Math.round(baseVolume.autos * mult),
    motos: Math.round(baseVolume.motos * mult),
    buses: Math.round(baseVolume.buses * mult),
    camiones: Math.round(baseVolume.camiones * mult * 0.8), // trucks avoid event times
    bicicletas: Math.round(baseVolume.bicicletas * mult * 0.6),
    total: Math.round(baseVolume.total * mult),
    avgSpeed: Math.round(baseVolume.avgSpeed * speedFactor * 10) / 10,
  };
}

/**
 * Get parking demand for a scenario at a given hour.
 */
export function getParkingDemand(
  scenario: Scenario,
  hour: number,
  totalSpaces: number
): { demand: number; occupancy: number; overflow: boolean } {
  const baseDemand = totalSpaces * 0.45; // 45% base occupancy
  const eventDemand =
    scenario.id === "normal"
      ? 0
      : scenario.parkingDemand *
        gaussian(hour, scenario.peakHour, scenario.peakSpread);

  const demand = Math.round(baseDemand + eventDemand);
  const occupancy = clamp(demand / totalSpaces, 0, 1.5);
  const overflow = demand > totalSpaces;

  return { demand, occupancy, overflow };
}

/**
 * Get pedestrian flow multiplier for a scenario at a given hour.
 */
export function getPedestrianFlow(scenario: Scenario, hour: number): number {
  // Base pedestrian pattern: peaks at 8, 12, 18
  const basePed =
    0.3 +
    0.3 * gaussian(hour, 8, 2) +
    0.5 * gaussian(hour, 12, 1.5) +
    0.7 * gaussian(hour, 18, 2);

  if (scenario.id === "normal") return basePed;

  const eventPed =
    (scenario.attendance / 10_000) *
    gaussian(hour, scenario.peakHour, scenario.peakSpread);

  return basePed + eventPed;
}

/**
 * Get parking tariff for a scenario at a given hour.
 */
export function getTariff(
  scenario: Scenario,
  hour: number,
  baseTariff: number,
  maxTariff: number
): number {
  const factor =
    scenario.surchargeMultiplier *
    gaussian(hour, scenario.peakHour, scenario.peakSpread);
  const tariff = baseTariff * Math.max(1, factor);
  return Math.min(tariff, maxTariff);
}

/**
 * Get the currently applicable scenario from SCENARIOS.
 */
export function getScenario(id: string): Scenario {
  return SCENARIOS[id as keyof typeof SCENARIOS] ?? SCENARIOS.normal;
}
