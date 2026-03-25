import type { FinancialParams } from "@/types";

export const DEFAULT_FINANCIAL_PARAMS: FinancialParams = {
  parkingSpaces: 1100,
  parkingFloors: 2,
  baseTariff: 5_000,       // COP/hr
  maxTariff: 15_000,       // COP/hr (events)
  monthlyPassPrice: 400_000, // COP
  monthlyPassSlots: 40,
  valetPrice: 15_000,      // COP per service
  valetServicesPerEvent: 150,
  commerceArea: 2_000,     // m2
  commerceRentMin: 60_000, // COP/m2/month
  commerceRentMax: 120_000,
  commerceOccupancy: 0.85,
  operatingCostPct: 0.30,
  eventsPerYear: 52,        // 52 sundays/year (one event per week)
  avgEventUplift: 8_000_000, // COP per event
};

export const OPERATING_HOURS = 14; // 6am - 8pm base
export const BASE_OCCUPANCY = 0.45; // aligned with scenario engine
export const VALET_EVENTS_PER_YEAR = 30;
