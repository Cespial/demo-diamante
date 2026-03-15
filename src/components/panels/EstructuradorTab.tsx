"use client";

import { useMemo } from "react";
import type {
  Scenario,
  ParkingPOI,
  TrafficAforo,
  CommercePOI,
  ODRoute,
  CalendarEvent,
  FinancialParams,
} from "@/types";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { useData } from "@/lib/hooks";
import { formatCOP, formatNumber } from "@/lib/utils";
import {
  DEFAULT_FINANCIAL_PARAMS,
  OPERATING_HOURS,
  VALET_EVENTS_PER_YEAR,
} from "@/data/financial-params";

// ── Types for loaded data ──
interface MacroContextFull {
  population: {
    comuna11: {
      name: string;
      habitantes: number;
      estrato_predominante: number;
      area_km2: number;
      densidad_hab_km2: number;
      source: string;
    };
    adjacentComunas: {
      id: number;
      name: string;
      habitantes: number;
      estrato_predominante: number;
    }[];
    catchmentArea: { total: number; description: string };
    medellin: { total: number; source: string };
  };
  commercialRents: Record<string, { min: number; max: number; unit?: string; notes?: string }>;
  macro: {
    trm: { value: number; unit: string; date: string; source: string };
    ipc: { value: number; unit: string; period: string; source: string };
    tasaInteres: { value: number; unit: string; type: string; source: string; date: string };
    pib: { growth: number; unit: string; period: string; source: string };
    desempleo: { medellin: number; nacional: number; unit: string; period: string; source: string };
    salarioMinimo: { value: number; unit: string; year: number; source: string };
  };
  businessCount: {
    laureles_estadio: number;
    total_medellin: number;
    source: string;
    notes: string;
  };
  diamanteContext: {
    location: { name: string; lat: number; lng: number; comuna: number; barrio: string };
    stadiumCapacity: Record<string, number>;
    keyMetrics: Record<string, number | string>;
    transportAccess: {
      metroStations: string[];
      busRoutes: number;
      parkingSpots: number;
      bikeStations: number;
    };
  };
}

interface HotelPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  subcategory: string;
  rating?: number | null;
  reviewCount?: number;
}

// ── Props ──
interface EstructuradorTabProps {
  scenario: Scenario;
  hour: number;
}

// ── Reusable table row ──
function Row({
  label,
  value,
  bold,
  highlight,
  indent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: string;
  indent?: boolean;
}) {
  return (
    <tr className={bold ? "border-t border-white/10" : ""}>
      <td
        className={`py-1 pr-3 text-xs text-white/60 ${indent ? "pl-4" : ""}`}
      >
        {label}
      </td>
      <td
        className={`py-1 text-xs text-right ${
          bold ? "font-bold" : "font-medium"
        }`}
        style={{ color: highlight ?? (bold ? "#f59e0b" : "#e2e8f0") }}
      >
        {value}
      </td>
    </tr>
  );
}

// ── Scenario-specific financial params builder ──
function buildScenarioParams(
  type: "conservador" | "base" | "optimista"
): FinancialParams {
  const configs = {
    conservador: {
      parkingSpaces: 800,
      occupancy: 0.4,
      tariff: 4_000,
      costPct: 0.35,
      events: 40,
    },
    base: {
      parkingSpaces: 1100,
      occupancy: 0.5,
      tariff: 5_000,
      costPct: 0.3,
      events: 55,
    },
    optimista: {
      parkingSpaces: 1100,
      occupancy: 0.65,
      tariff: 6_000,
      costPct: 0.25,
      events: 70,
    },
  };
  const c = configs[type];
  return {
    ...DEFAULT_FINANCIAL_PARAMS,
    parkingSpaces: c.parkingSpaces,
    baseTariff: c.tariff,
    operatingCostPct: c.costPct,
    eventsPerYear: c.events,
  };
}

// ── Custom calculateFinancials with occupancy override ──
function calcWithOccupancy(
  params: FinancialParams,
  occupancy: number
) {
  const parkingBase =
    params.parkingSpaces *
    occupancy *
    OPERATING_HOURS *
    params.baseTariff *
    365;

  const parkingSurcharge = params.eventsPerYear * params.avgEventUplift;
  const monthlyPasses =
    params.monthlyPassSlots * params.monthlyPassPrice * 12;
  const valetRevenue =
    VALET_EVENTS_PER_YEAR *
    params.valetServicesPerEvent *
    params.valetPrice;
  const commerceRent =
    params.commerceArea *
    params.commerceOccupancy *
    ((params.commerceRentMin + params.commerceRentMax) / 2) *
    12;

  const totalGross =
    parkingBase + parkingSurcharge + monthlyPasses + valetRevenue + commerceRent;
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

// ── Main Component ──
export function EstructuradorTab({ scenario, hour }: EstructuradorTabProps) {
  // Data hooks
  const { data: macro } = useData<MacroContextFull>("/data/macro-context.json");
  const { data: aforos } = useData<TrafficAforo[]>("/data/traffic-aforos.json");
  const { data: events } = useData<CalendarEvent[]>("/data/events-calendar.json");
  const { data: odRoutes } = useData<ODRoute[]>("/data/od-routes.json");
  const { data: parking } = useData<ParkingPOI[]>("/data/parking-pois.json");
  const { data: commerce } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: hotels } = useData<HotelPOI[]>("/data/hotels-pois.json");

  // ── Derived metrics ──
  const trafficMetrics = useMemo(() => {
    if (!aforos) return { intersections: 0, totalRecords: 0, peakVolume: 0 };
    const intersections = aforos.length;
    const totalRecords = aforos.reduce((s, a) => s + a.hourly.length, 0);
    const peakVolume = aforos.reduce((s, a) => {
      const h17 = a.hourly.find((h) => h.hour === 17);
      return s + (h17?.total ?? 0);
    }, 0);
    return { intersections, totalRecords, peakVolume };
  }, [aforos]);

  const eventMetrics = useMemo(() => {
    if (!events) return { total: 0, totalAttendance: 0, avgAttendance: 0, partidosLiga: 0, conciertos: 0, ligasNocturnas: 0 };
    const total = events.length;
    const totalAttendance = events.reduce((s, e) => s + e.attendance, 0);
    const avgAttendance = total > 0 ? Math.round(totalAttendance / total) : 0;
    const partidosLiga = events.filter(
      (e) => e.type === "partido_liga" || e.type === "clasico"
    ).length;
    const conciertos = events.filter((e) => e.type === "concierto").length;
    const ligasNocturnas = events.filter(
      (e) => e.type === "liga_nocturna"
    ).length;
    return { total, totalAttendance, avgAttendance, partidosLiga, conciertos, ligasNocturnas };
  }, [events]);

  const odMetrics = useMemo(() => {
    if (!odRoutes) return { origins: 0, avgDuration: 0 };
    const origins = odRoutes.length;
    let totalDuration = 0;
    let count = 0;
    odRoutes.forEach((o) =>
      o.routes.forEach((r) => {
        totalDuration += r.duration;
        count++;
      })
    );
    const avgDuration = count > 0 ? Math.round(totalDuration / count) : 0;
    return { origins, avgDuration };
  }, [odRoutes]);

  const parkingMetrics = useMemo(() => {
    if (!parking) return { count: 0, totalCapacity: 0, avgTarifaMin: 0, avgTarifaMax: 0 };
    const count = parking.length;
    const totalCapacity = parking.reduce((s, p) => s + p.capacity, 0);
    const avgTarifaMin = Math.round(parking.reduce((s, p) => s + p.tarifaMin, 0) / count);
    const avgTarifaMax = Math.round(parking.reduce((s, p) => s + p.tarifaMax, 0) / count);
    return { count, totalCapacity, avgTarifaMin, avgTarifaMax };
  }, [parking]);

  const commerceMetrics = useMemo(() => {
    if (!commerce) return { count: 0, avgRatingRestaurants: 0 };
    const count = commerce.length;
    const restaurants = commerce.filter(
      (c) =>
        c.category === "restaurant" ||
        c.subcategory === "restaurant"
    );
    const rated = restaurants.filter((r) => r.rating != null && r.rating > 0);
    const avgRatingRestaurants =
      rated.length > 0
        ? +(rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length).toFixed(1)
        : 0;
    return { count, avgRatingRestaurants };
  }, [commerce]);

  const hotelsCount = hotels?.length ?? 0;

  // ── Financial scenarios ──
  const scenarios = useMemo(() => {
    const conservadorParams = buildScenarioParams("conservador");
    const baseParams = buildScenarioParams("base");
    const optimistaParams = buildScenarioParams("optimista");

    return {
      conservador: calcWithOccupancy(conservadorParams, 0.4),
      base: calcWithOccupancy(baseParams, 0.5),
      optimista: calcWithOccupancy(optimistaParams, 0.6),
    };
  }, []);

  // ── Investment indicators (base scenario) ──
  const investmentMetrics = useMemo(() => {
    const capex = 82_500_000_000; // 1,100 celdas x $75M/celda
    const wacc = 0.12;
    const baseNet = scenarios.base.netIncome;

    // NPV over 10 years
    let vpn = -capex;
    for (let y = 1; y <= 10; y++) {
      vpn += baseNet / Math.pow(1 + wacc, y);
    }

    // Payback
    const payback = baseNet > 0 ? capex / baseNet : Infinity;

    // ROI
    const roi = baseNet > 0 ? (baseNet / capex) * 100 : 0;

    // Simple TIR approximation: if VPN > 0 then TIR > WACC
    const tirLabel =
      vpn > 0
        ? `> ${(wacc * 100).toFixed(0)}% (proyecto viable)`
        : `< ${(wacc * 100).toFixed(0)}% (revisar)`;

    return { capex, wacc, vpn, payback, roi, tirLabel };
  }, [scenarios.base.netIncome]);

  // ── Cronograma data ──
  const cronograma = [
    { fase: "Pre-factibilidad", duracion: "3-4 meses", entidad: "Promotor" },
    { fase: "Factibilidad", duracion: "4-6 meses", entidad: "Promotor + Asesores" },
    { fase: "Aprobacion POT / Licencia", duracion: "2-3 meses", entidad: "Curaduria + Planeacion" },
    { fase: "Licencia ambiental", duracion: "1-2 meses", entidad: "Area Metropolitana" },
    { fase: "Estructuracion APP", duracion: "6-8 meses", entidad: "DNP + ANI" },
    { fase: "Licitacion", duracion: "3-4 meses", entidad: "SECOP" },
    { fase: "Adjudicacion", duracion: "1-2 meses", entidad: "Comite evaluador" },
    { fase: "Diseno detallado", duracion: "4-6 meses", entidad: "Constructor" },
    { fase: "Construccion", duracion: "18-24 meses", entidad: "Constructor" },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          Estructurador — Resumen Pre-factibilidad
        </h2>
        <p className="text-xs text-white/40">
          Documento de trabajo para evaluacion de viabilidad del proyecto
          Diamante de Beisbol.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: FICHA TECNICA
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">1.</span> Ficha
          Tecnica del Proyecto
        </CardHeader>
        <CardContent>
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Proyecto"
                value="Diamante de Beisbol de Medellin — Parqueaderos Publicos + Comercio a Nivel"
              />
              <Row
                label="Ubicacion"
                value="Unidad Deportiva Atanasio Girardot, Comuna 11 (Laureles-Estadio)"
              />
              <Row label="Coordenadas" value="6.2565 N, -75.5905 W" />
              <Row label="Promotor" value="Estima" />
              <Row
                label="Marco Legal"
                value="APP Ley 1508 de 2012, Acuerdo 48 de 2014 (POT Medellin)"
              />
              <Row
                label="Componentes"
                value="2 sotanos parqueadero publico (1,100 celdas) + ~2,000 m2 comercio a nivel"
              />
              <Row label="Fase actual" value="Pre-factibilidad" />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: CONTEXTO MACROECONOMICO
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">2.</span> Contexto
          Macroeconomico
        </CardHeader>
        <CardContent>
          {macro ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <KPICard
                  label="TRM"
                  value={`$${macro.macro.trm.value.toLocaleString("es-CO")} COP/USD`}
                  subtitle={macro.macro.trm.date}
                  color="#3b82f6"
                />
                <KPICard
                  label="IPC (anual)"
                  value={`${macro.macro.ipc.value}%`}
                  subtitle={macro.macro.ipc.period}
                  color="#f59e0b"
                />
                <KPICard
                  label="Tasa de Interes"
                  value={`${macro.macro.tasaInteres.value}%`}
                  subtitle={macro.macro.tasaInteres.type}
                  color="#ef4444"
                />
                <KPICard
                  label="PIB Crecimiento"
                  value={`${macro.macro.pib.growth}%`}
                  subtitle={macro.macro.pib.period}
                  color="#22c55e"
                />
              </div>
              <table className="w-full text-left">
                <tbody>
                  <Row
                    label="Desempleo Medellin"
                    value={`${macro.macro.desempleo.medellin}% (${macro.macro.desempleo.period})`}
                  />
                  <Row
                    label="SMMLV 2026"
                    value={`$${macro.macro.salarioMinimo.value.toLocaleString("es-CO")} COP/mes`}
                  />
                  <Row
                    label="Poblacion Medellin"
                    value={macro.population.medellin.total.toLocaleString("es-CO")}
                  />
                  <Row
                    label="Poblacion Comuna 11"
                    value={`${macro.population.comuna11.habitantes.toLocaleString("es-CO")} (estrato ${macro.population.comuna11.estrato_predominante})`}
                  />
                  <Row
                    label="Area de influencia"
                    value={`${macro.population.catchmentArea.total.toLocaleString("es-CO")} hab`}
                  />
                  <Row
                    label="Empresas registradas Laureles"
                    value={`${macro.businessCount.laureles_estadio.toLocaleString("es-CO")} (3ra comuna)`}
                  />
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-xs text-white/30">Cargando datos macro...</p>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3: ESTUDIO DE MERCADO — DEMANDA
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">3.</span> Estudio
          de Mercado — Demanda
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <KPICard
              label="Intersecciones monitoreadas"
              value={formatNumber(trafficMetrics.intersections)}
              subtitle="Aforos vehiculares reales"
              color="#3b82f6"
            />
            <KPICard
              label="Registros de aforo"
              value={formatNumber(trafficMetrics.totalRecords)}
              subtitle="Registros hora-interseccion"
              color="#3b82f6"
            />
            <KPICard
              label="Eventos/ano"
              value={formatNumber(eventMetrics.total)}
              subtitle={`${eventMetrics.partidosLiga} partidos + ${eventMetrics.conciertos} conciertos`}
              color="#f59e0b"
            />
            <KPICard
              label="Asistencia total/ano"
              value={formatNumber(eventMetrics.totalAttendance)}
              subtitle={`Promedio: ${formatNumber(eventMetrics.avgAttendance)}/evento`}
              color="#f59e0b"
            />
          </div>
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Volumen pico (hora 17)"
                value={`${formatNumber(trafficMetrics.peakVolume)} veh/hr`}
              />
              <Row
                label="Partidos futbol (liga)"
                value={`${eventMetrics.partidosLiga} eventos`}
              />
              <Row
                label="Conciertos"
                value={`${eventMetrics.conciertos} eventos`}
              />
              <Row
                label="Ligas nocturnas beisbol"
                value={`${eventMetrics.ligasNocturnas} jornadas`}
              />
              <Row
                label="Demanda base nocturna"
                value="~500 personas/noche (L-V)"
              />
              <Row
                label="Origenes monitoreados"
                value={`${odMetrics.origins} zonas`}
              />
              <Row
                label="Tiempo promedio viaje"
                value={`${Math.round(odMetrics.avgDuration / 60)} min`}
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4: ESTUDIO DE MERCADO — OFERTA (COMPETENCIA)
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">4.</span> Estudio
          de Mercado — Oferta (Competencia)
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <KPICard
              label="Parqueaderos en 1km"
              value={`${parkingMetrics.count}`}
              subtitle={`Capacidad: ${parkingMetrics.totalCapacity} celdas`}
              color="#a855f7"
            />
            <KPICard
              label="Tarifa promedio zona"
              value={`$${formatNumber(parkingMetrics.avgTarifaMin)} - $${formatNumber(parkingMetrics.avgTarifaMax)}`}
              subtitle="COP/hr (min-max)"
              color="#a855f7"
            />
            <KPICard
              label="Comercios Google (1km)"
              value={`${commerceMetrics.count}`}
              subtitle={`Rating rest.: ${commerceMetrics.avgRatingRestaurants}`}
              color="#ec4899"
            />
            <KPICard
              label="Hoteles (1.5km)"
              value={`${hotelsCount}`}
              subtitle="Google Places"
              color="#06b6d4"
            />
          </div>
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Gap oferta eventos"
                value="1,100 celdas propias vs demanda pico"
              />
              <Row
                label="Venues deportivos"
                value="51 (Unidad Deportiva completa)"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5: NORMATIVA URBANISTICA (POT)
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">5.</span> Normativa
          Urbanistica (POT Acuerdo 48/2014)
        </CardHeader>
        <CardContent>
          <table className="w-full text-left">
            <tbody>
              <Row label="Tratamiento" value="CN3 (Consolidacion Nivel 3)" />
              <Row
                label="Uso del suelo"
                value="Mixto (Residencial + Comercial + Deportivo + Dotacional)"
              />
              <Row
                label="Indice de Ocupacion (IO)"
                value="0.70 (70% maximo)"
              />
              <Row label="Indice de Construccion (IC)" value="3.5" />
              <Row
                label="Altura maxima"
                value="5-8 pisos (segun predio)"
              />
              <Row label="Retiro frontal" value="5 m" />
              <Row label="Retiro lateral" value="3 m" />
              <Row
                label="Estacionamientos"
                value="1 celda por cada 80 m2 construidos"
              />
              <Row
                label="Sotanos"
                value="Compatibles con norma — no computan como area construida"
              />
              <Row
                label="Bienes de interes cultural"
                value="Estadio Atanasio Girardot (BIC Municipal)"
              />
              <Row
                label="Area influencia BIC"
                value="Radio de proteccion aplica"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6: MODELO FINANCIERO (3 ESCENARIOS)
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">6.</span> Modelo
          Financiero — Tres Escenarios
        </CardHeader>
        <CardContent>
          {/* Scenario params summary */}
          <div className="mb-3 rounded border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left p-1.5 text-white/50 font-medium">
                    Parametro
                  </th>
                  <th className="text-center p-1.5 text-red-400 font-medium">
                    Conservador
                  </th>
                  <th className="text-center p-1.5 text-amber-400 font-medium">
                    Base
                  </th>
                  <th className="text-center p-1.5 text-green-400 font-medium">
                    Optimista
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-1.5 text-white/60">Celdas</td>
                  <td className="p-1.5 text-center text-white/80">150</td>
                  <td className="p-1.5 text-center text-white/80">200</td>
                  <td className="p-1.5 text-center text-white/80">250</td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Ocupacion</td>
                  <td className="p-1.5 text-center text-white/80">40%</td>
                  <td className="p-1.5 text-center text-white/80">50%</td>
                  <td className="p-1.5 text-center text-white/80">60%</td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Tarifa/hr</td>
                  <td className="p-1.5 text-center text-white/80">$4,000</td>
                  <td className="p-1.5 text-center text-white/80">$5,000</td>
                  <td className="p-1.5 text-center text-white/80">$6,000</td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Costos operativos</td>
                  <td className="p-1.5 text-center text-white/80">35%</td>
                  <td className="p-1.5 text-center text-white/80">30%</td>
                  <td className="p-1.5 text-center text-white/80">25%</td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Eventos/ano</td>
                  <td className="p-1.5 text-center text-white/80">40</td>
                  <td className="p-1.5 text-center text-white/80">55</td>
                  <td className="p-1.5 text-center text-white/80">70</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Results table */}
          <div className="rounded border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left p-1.5 text-white/50 font-medium">
                    Rubro (anual)
                  </th>
                  <th className="text-right p-1.5 text-red-400 font-medium">
                    Conservador
                  </th>
                  <th className="text-right p-1.5 text-amber-400 font-medium">
                    Base
                  </th>
                  <th className="text-right p-1.5 text-green-400 font-medium">
                    Optimista
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="p-1.5 text-white/60">Parking base</td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.conservador.parkingBase)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.base.parkingBase)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.optimista.parkingBase)}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Surcharge eventos</td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.conservador.parkingSurcharge)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.base.parkingSurcharge)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.optimista.parkingSurcharge)}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Pases mensuales</td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.conservador.monthlyPasses)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.base.monthlyPasses)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.optimista.monthlyPasses)}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Valet</td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.conservador.valetRevenue)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.base.valetRevenue)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.optimista.valetRevenue)}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Comercio renta</td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.conservador.commerceRent)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.base.commerceRent)}
                  </td>
                  <td className="p-1.5 text-right text-white/80">
                    {formatCOP(scenarios.optimista.commerceRent)}
                  </td>
                </tr>
                <tr className="bg-white/5 font-bold">
                  <td className="p-1.5 text-white/80">TOTAL BRUTO</td>
                  <td className="p-1.5 text-right text-red-300">
                    {formatCOP(scenarios.conservador.totalGross)}
                  </td>
                  <td className="p-1.5 text-right text-amber-300">
                    {formatCOP(scenarios.base.totalGross)}
                  </td>
                  <td className="p-1.5 text-right text-green-300">
                    {formatCOP(scenarios.optimista.totalGross)}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 text-white/60">Costos operativos</td>
                  <td className="p-1.5 text-right text-red-400/70">
                    -{formatCOP(scenarios.conservador.operatingCosts)}
                  </td>
                  <td className="p-1.5 text-right text-amber-400/70">
                    -{formatCOP(scenarios.base.operatingCosts)}
                  </td>
                  <td className="p-1.5 text-right text-green-400/70">
                    -{formatCOP(scenarios.optimista.operatingCosts)}
                  </td>
                </tr>
                <tr className="bg-white/5 font-bold border-t-2 border-white/20">
                  <td className="p-1.5 text-white">INGRESO NETO</td>
                  <td className="p-1.5 text-right text-red-300">
                    {formatCOP(scenarios.conservador.netIncome)}
                  </td>
                  <td className="p-1.5 text-right text-amber-300">
                    {formatCOP(scenarios.base.netIncome)}
                  </td>
                  <td className="p-1.5 text-right text-green-300">
                    {formatCOP(scenarios.optimista.netIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7: INDICADORES DE INVERSION
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">7.</span>{" "}
          Indicadores de Inversion
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <KPICard
              label="CAPEX estimado"
              value={formatCOP(investmentMetrics.capex)}
              subtitle="1,100 celdas x $75M/celda (sotano)"
              color="#ef4444"
            />
            <KPICard
              label="WACC"
              value={`${(investmentMetrics.wacc * 100).toFixed(0)}%`}
              subtitle="Tasa tipica inmobiliario COL"
              color="#f59e0b"
            />
            <KPICard
              label="VPN (10 anos, 12%)"
              value={formatCOP(Math.abs(investmentMetrics.vpn))}
              subtitle={investmentMetrics.vpn >= 0 ? "VPN positivo — viable" : "VPN negativo — revisar"}
              trend={investmentMetrics.vpn >= 0 ? "up" : "down"}
              trendValue={investmentMetrics.vpn >= 0 ? "VIABLE" : "NO VIABLE"}
              color={investmentMetrics.vpn >= 0 ? "#22c55e" : "#ef4444"}
            />
            <KPICard
              label="TIR estimada"
              value={investmentMetrics.tirLabel}
              subtitle="Tasa interna de retorno"
              color="#a855f7"
            />
          </div>
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Payback simple"
                value={`${investmentMetrics.payback.toFixed(1)} anos`}
              />
              <Row
                label="ROI anual"
                value={`${investmentMetrics.roi.toFixed(1)}%`}
              />
              <Row
                label="Ingreso neto anual (base)"
                value={formatCOP(scenarios.base.netIncome)}
                bold
                highlight="#22c55e"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 8: BENCHMARKS
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">8.</span>{" "}
          Benchmarks
        </CardHeader>
        <CardContent>
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Consultores actuales Estima"
                value="$909M COP"
                highlight="#ef4444"
              />
              <Row
                label="APP anterior (Quintero, 2020)"
                value="$1.6 billones inversion, $4,000M estructuracion"
              />
              <Row
                label="APP anterior resultado"
                value="Declarada desierta (abril 2024)"
                highlight="#ef4444"
              />
              <Row
                label="Renovacion actual (Gutierrez, 2025)"
                value="~$730,000M total, ~$450,000M publicos"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 9: CRONOGRAMA REGULATORIO
         ════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <span className="text-sm font-bold text-amber-400">9.</span>{" "}
          Cronograma Regulatorio
        </CardHeader>
        <CardContent>
          <div className="rounded border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left p-1.5 text-white/50 font-medium">
                    Fase
                  </th>
                  <th className="text-center p-1.5 text-white/50 font-medium">
                    Duracion
                  </th>
                  <th className="text-right p-1.5 text-white/50 font-medium">
                    Entidad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cronograma.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1.5 text-white/70">{row.fase}</td>
                    <td className="p-1.5 text-center text-amber-300 font-medium">
                      {row.duracion}
                    </td>
                    <td className="p-1.5 text-right text-white/50">
                      {row.entidad}
                    </td>
                  </tr>
                ))}
                <tr className="bg-white/5 font-bold">
                  <td className="p-1.5 text-white">TOTAL ESTIMADO</td>
                  <td className="p-1.5 text-center text-amber-400 font-bold">
                    ~42-59 meses
                  </td>
                  <td className="p-1.5 text-right text-white/50">
                    ~3.5-5 anos
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual timeline bar */}
          <div className="mt-3 space-y-1">
            {cronograma.map((row, i) => {
              // Extract max months for bar width
              const match = row.duracion.match(/(\d+)/g);
              const maxMonths = match
                ? parseInt(match[match.length - 1])
                : 4;
              const widthPct = Math.min((maxMonths / 24) * 100, 100);
              const colors = [
                "#3b82f6",
                "#6366f1",
                "#8b5cf6",
                "#a855f7",
                "#d946ef",
                "#ec4899",
                "#f43f5e",
                "#f59e0b",
                "#22c55e",
              ];
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-28 text-[10px] text-white/40 truncate text-right">
                    {row.fase}
                  </div>
                  <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: colors[i % colors.length],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <div className="w-16 text-[10px] text-white/30 text-right">
                    {row.duracion}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="pt-2 pb-4 text-center">
        <p className="text-[10px] text-white/20">
          Documento generado por tensor.lat — Datos reales: DANE, BanRep, SIMM,
          Google Places, datos.gov.co, Lonja de Propiedad Raiz de Medellin
        </p>
      </div>
    </div>
  );
}
