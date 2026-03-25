import type { FinancialParams, FinancialResult } from "@/types";
import {
  DEFAULT_FINANCIAL_PARAMS,
  OPERATING_HOURS,
  BASE_OCCUPANCY,
  VALET_EVENTS_PER_YEAR,
} from "@/data/financial-params";

export function calculateFinancials(
  params: FinancialParams = DEFAULT_FINANCIAL_PARAMS
): FinancialResult {
  // Parking base revenue
  // Normal days (365 - events): base tariff × occupancy × hours
  const normalDays = 365 - params.eventsPerYear;
  const parkingBaseNormal =
    params.parkingSpaces *
    BASE_OCCUPANCY *
    OPERATING_HOURS *
    params.baseTariff *
    normalDays;

  // Event days (52): full tariff $35,000/día reference (≈ $5,000/hr × 7hr avg stay)
  const EVENT_DAILY_TARIFF = 35_000; // COP/day — reference: Obelisco $27K, premium $35K
  const EVENT_OCCUPANCY = 0.85; // higher occupancy on event days
  const parkingBaseEvents =
    params.parkingSpaces *
    EVENT_OCCUPANCY *
    EVENT_DAILY_TARIFF *
    params.eventsPerYear;

  const parkingBase = parkingBaseNormal + parkingBaseEvents;

  // Event surcharge (additional uplift beyond base)
  const parkingSurcharge = params.eventsPerYear * params.avgEventUplift;

  // Monthly passes
  const monthlyPasses =
    params.monthlyPassSlots * params.monthlyPassPrice * 12;

  // Valet
  const valetRevenue =
    VALET_EVENTS_PER_YEAR *
    params.valetServicesPerEvent *
    params.valetPrice;

  // Commerce rent
  const commerceRent =
    params.commerceArea *
    params.commerceOccupancy *
    ((params.commerceRentMin + params.commerceRentMax) / 2) *
    12;

  const totalGross =
    parkingBase +
    parkingSurcharge +
    monthlyPasses +
    valetRevenue +
    commerceRent;

  const operatingCosts = totalGross * params.operatingCostPct;
  const netIncome = totalGross - operatingCosts;

  return {
    parkingBase,
    parkingSurcharge,
    monthlyPasses,
    valetRevenue,
    commerceRent,
    totalGross,
    operatingCosts,
    netIncome,
  };
}

export function calculateMonthlyProjection(
  params: FinancialParams = DEFAULT_FINANCIAL_PARAMS
): { month: string; gross: number; net: number }[] {
  const annual = calculateFinancials(params);
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  // Seasonal multipliers (events concentrate in certain months)
  const seasonality = [
    0.85, 0.80, 0.90, 0.95, 1.00, 1.05,
    1.10, 1.20, 1.05, 1.00, 0.95, 1.15,
  ];

  return months.map((month, i) => {
    const monthlyGross = (annual.totalGross / 12) * seasonality[i];
    return {
      month,
      gross: Math.round(monthlyGross),
      net: Math.round(monthlyGross * (1 - params.operatingCostPct)),
    };
  });
}
