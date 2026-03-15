"use client";

import type { Scenario, ParkingPOI, TrafficAforo, CommercePOI, ODRoute, MacroContext } from "@/types";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { useData } from "@/lib/hooks";
import { formatCOP, formatNumber } from "@/lib/utils";
import { calculateFinancials } from "@/lib/financial-model";
import { getParkingDemand, applyScenarioToTraffic } from "@/lib/scenario-engine";

interface ExecutiveTabProps {
  scenario: Scenario;
  hour: number;
}

export function ExecutiveTab({ scenario, hour }: ExecutiveTabProps) {
  const { data: parking } = useData<ParkingPOI[]>("/data/parking-pois.json");
  const { data: aforos } = useData<TrafficAforo[]>("/data/traffic-aforos.json");
  const { data: commerce } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: odRoutes } = useData<ODRoute[]>("/data/od-routes.json");
  const { data: macro } = useData<MacroContext>("/data/macro-context.json");

  const financials = calculateFinancials();
  const parkingInfo = getParkingDemand(scenario, hour, 200);

  // Aggregate traffic volume at current hour across all intersections
  const totalVolume = aforos
    ? aforos.reduce((sum, a) => {
        const hv = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
        const adj = applyScenarioToTraffic(hv, scenario, hour);
        return sum + adj.total;
      }, 0)
    : 0;

  const competitorSpaces = parking
    ? parking.reduce((s, p) => s + p.capacity, 0)
    : 0;

  const commerceCount = commerce?.length ?? 0;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Resumen Ejecutivo</h2>
        <p className="text-xs text-white/40">
          Escenario: <span style={{ color: scenario.color }} className="font-semibold">{scenario.name}</span>
          {scenario.attendance > 0 && ` — ${formatNumber(scenario.attendance)} asistentes`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Ingreso Neto Anual"
          value={formatCOP(financials.netIncome)}
          subtitle="Parking + Comercio + Valet"
          color="#22c55e"
        />
        <KPICard
          label="Vehículos/hr (ahora)"
          value={formatNumber(totalVolume)}
          subtitle={`Multiplicador: ${scenario.vehicleMultiplier}x`}
          color="#3b82f6"
        />
        <KPICard
          label="Ocupación Parking"
          value={`${Math.round(parkingInfo.occupancy * 100)}%`}
          subtitle={`${parkingInfo.demand} / 200 celdas`}
          trend={parkingInfo.overflow ? "up" : "neutral"}
          trendValue={parkingInfo.overflow ? "OVERFLOW" : "OK"}
          color={parkingInfo.overflow ? "#ef4444" : "#f59e0b"}
        />
        <KPICard
          label="Competencia Parking"
          value={formatNumber(competitorSpaces)}
          subtitle={`${parking?.length ?? 0} parqueaderos en 1.5km`}
          color="#a855f7"
        />
      </div>

      <Card>
        <CardHeader>¿Dónde está mi plata?</CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs text-white/60">
            <RevenueRow label="Parking base" value={financials.parkingBase} pct={financials.parkingBase / financials.totalGross} />
            <RevenueRow label="Surcharge eventos" value={financials.parkingSurcharge} pct={financials.parkingSurcharge / financials.totalGross} />
            <RevenueRow label="Pases mensuales" value={financials.monthlyPasses} pct={financials.monthlyPasses / financials.totalGross} />
            <RevenueRow label="Valet" value={financials.valetRevenue} pct={financials.valetRevenue / financials.totalGross} />
            <RevenueRow label="Comercio renta" value={financials.commerceRent} pct={financials.commerceRent / financials.totalGross} />
            <div className="border-t border-white/10 pt-2 flex justify-between font-semibold text-white">
              <span>Total Bruto</span>
              <span>{formatCOP(financials.totalGross)} /año</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>Costos Operativos (30%)</span>
              <span>-{formatCOP(financials.operatingCosts)}</span>
            </div>
            <div className="flex justify-between font-bold text-green-400 text-sm">
              <span>Ingreso Neto</span>
              <span>{formatCOP(financials.netIncome)} /año</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Contexto de la Zona</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60">
            <div className="flex justify-between">
              <span>Población Comuna 11</span>
              <span className="text-white/80">{formatNumber(macro?.population?.comuna11 ?? 72803)} hab</span>
            </div>
            <div className="flex justify-between">
              <span>Área de influencia</span>
              <span className="text-white/80">{formatNumber(macro?.population?.catchmentArea ?? 449000)} hab</span>
            </div>
            <div className="flex justify-between">
              <span>Negocios registrados</span>
              <span className="text-white/80">{formatNumber(macro?.businessCount?.laureles_estadio ?? 11247)}</span>
            </div>
            <div className="flex justify-between">
              <span>Comercios en 1km (Google)</span>
              <span className="text-white/80">{commerceCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Parqueaderos competidores</span>
              <span className="text-white/80">{parking?.length ?? 0} ({formatNumber(competitorSpaces)} celdas)</span>
            </div>
            <div className="flex justify-between">
              <span>Tarifa promedio zona</span>
              <span className="text-white/80">$4,000–$8,000/hr</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OD Routes summary */}
      {odRoutes && odRoutes.length > 0 && (
        <Card>
          <CardHeader>Accesibilidad — Tiempos de Viaje</CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-white/60">
              {odRoutes.map((od) => (
                <div key={od.origin} className="flex justify-between">
                  <span>{od.origin}</span>
                  <span className="text-white/80">{od.routes[0]?.durationText || `${Math.round((od.routes[0]?.duration ?? 0) / 60)} min`}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Rutas con tráfico real — Google Routes API
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Conclusiones</CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-xs text-white/60 list-disc list-inside">
            <li>200 celdas de parqueadero generan <span className="text-green-400 font-medium">{formatCOP(financials.parkingBase + financials.parkingSurcharge + financials.monthlyPasses)}/año</span> combinando base + eventos + pases</li>
            <li>Los ~55 eventos/año representan un <span className="text-blue-400 font-medium">uplift del {Math.round((financials.parkingSurcharge / financials.parkingBase) * 100)}%</span> sobre ingresos base</li>
            <li>El comercio a nivel aporta <span className="text-purple-400 font-medium">{formatCOP(financials.commerceRent)}/año</span> con ocupación del 85%</li>
            <li>La zona tiene alta demanda no atendida en eventos masivos (&gt;45K asistentes)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function RevenueRow({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex justify-between">
        <span>{label}</span>
        <span className="text-white/80">{formatCOP(value)}</span>
      </div>
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-[10px]">{Math.round(pct * 100)}%</span>
    </div>
  );
}
