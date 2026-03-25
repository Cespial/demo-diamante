"use client";

import type { Scenario, ParkingPOI, TrafficAforo, CommercePOI, ODRoute, MacroContext, CalendarEvent } from "@/types";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { useData } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import { applyScenarioToTraffic } from "@/lib/scenario-engine";

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
  const { data: events } = useData<CalendarEvent[]>("/data/events-calendar.json");

  // Aggregate traffic volume at current hour across all intersections
  const totalVolume = aforos
    ? aforos.reduce((sum, a) => {
        const hv = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
        const adj = applyScenarioToTraffic(hv, scenario, hour);
        return sum + adj.total;
      }, 0)
    : 0;

  // Compute daily traffic (sum across 24 hours) for normal scenario
  const dailyTrafficNormal = aforos
    ? aforos.reduce((sum, a) => {
        return sum + a.hourly.reduce((s, hv) => s + hv.total, 0);
      }, 0)
    : 0;

  const competitorSpaces = parking
    ? parking.reduce((s, p) => s + p.capacity, 0)
    : 0;

  const commerceCount = commerce?.length ?? 0;
  const totalEvents = events?.length ?? 0;
  const totalAttendance = events?.reduce((s, e) => s + e.attendance, 0) ?? 0;

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
          label="Vehículos/hr (ahora)"
          value={formatNumber(totalVolume)}
          subtitle={`Multiplicador: ${scenario.vehicleMultiplier}x`}
          color="#3b82f6"
        />
        <KPICard
          label="Tráfico diario (normal)"
          value={formatNumber(dailyTrafficNormal)}
          subtitle="Suma 24hrs — 41 intersecciones"
          color="#60a5fa"
        />
        <KPICard
          label="Eventos/Año"
          value={formatNumber(totalEvents)}
          subtitle={`~${formatNumber(totalAttendance)} asistentes totales`}
          color="#f59e0b"
        />
        <KPICard
          label="Oferta Parking Zona"
          value={formatNumber(competitorSpaces)}
          subtitle={`${parking?.length ?? 0} parqueaderos en 1.5km`}
          color="#a855f7"
        />
      </div>

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
              <span>Referencia tarifa Obelisco</span>
              <span className="text-white/80">$27,000/día</span>
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
              Destino: Polígono Diamante · Fuente: Google Routes API
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Oportunidad</CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-xs text-white/60 list-disc list-inside">
            <li>El Atanasio tiene <span className="text-red-400 font-bold">cero celdas</span> de parking formal dedicado</li>
            <li>Oferta actual en 1.5km: <span className="text-blue-400 font-medium">{formatNumber(competitorSpaces)} celdas</span> en {parking?.length ?? 0} parqueaderos</li>
            <li>~52 eventos/año con asistencia promedio de {formatNumber(totalEvents > 0 ? Math.round(totalAttendance / totalEvents) : 25000)} personas</li>
            <li>Zona con alta demanda no atendida en eventos masivos (&gt;45K asistentes)</li>
            <li>Parqueo informal (&quot;trapitos rojos&quot;) cobra ~$10,000/carro en vía pública</li>
          </ul>
          <p className="text-[10px] text-white/25 mt-2 italic">
            Nota: Cifras financieras disponibles en la pestaña Financiero y Decisión (estimaciones preliminares)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
