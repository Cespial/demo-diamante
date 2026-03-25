"use client";

import type { Scenario, TrafficAforo, ODRoute } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { TrafficHourlyChart } from "@/components/charts/TrafficHourlyChart";
import { useData } from "@/lib/hooks";
import { formatNumber, hourLabel } from "@/lib/utils";
import { applyScenarioToTraffic } from "@/lib/scenario-engine";
import { Skeleton } from "@/components/ui/Skeleton";

interface TrafficTabProps {
  scenario: Scenario;
  hour: number;
}

export function TrafficTab({ scenario, hour }: TrafficTabProps) {
  const { data: aforos, loading } = useData<TrafficAforo[]>("/data/traffic-aforos.json");
  const { data: odRoutes } = useData<ODRoute[]>("/data/od-routes.json");
  const { data: closureRoutes } = useData<any[]>("/data/closure-routes.json");

  if (loading || !aforos) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Aggregate current hour
  const totals = aforos.reduce(
    (acc, a) => {
      const base = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
      const adj = applyScenarioToTraffic(base, scenario, hour);
      acc.autos += adj.autos;
      acc.motos += adj.motos;
      acc.buses += adj.buses;
      acc.camiones += adj.camiones;
      acc.bicicletas += adj.bicicletas;
      acc.total += adj.total;
      acc.speedSum += adj.avgSpeed;
      acc.count++;
      return acc;
    },
    { autos: 0, motos: 0, buses: 0, camiones: 0, bicicletas: 0, total: 0, speedSum: 0, count: 0 }
  );

  const avgSpeed = totals.count > 0 ? Math.round(totals.speedSum / totals.count) : 0;

  // Daily traffic (TPD) — sum across all 24 hours
  const dailyNormal = aforos.reduce((sum, a) => {
    return sum + a.hourly.reduce((s, hv) => s + hv.total, 0);
  }, 0);

  const dailyScenario = aforos.reduce((sum, a) => {
    return sum + a.hourly.reduce((s, hv) => {
      const adj = applyScenarioToTraffic(hv, scenario, hv.hour);
      return s + adj.total;
    }, 0);
  }, 0);

  const dailyDelta = dailyScenario - dailyNormal;

  // Closure analysis
  const closureAnalysis = closureRoutes
    ? closureRoutes.reduce((acc: any[], cr: any) => {
        const existing = acc.find((a) => a.origin === cr.origin);
        if (!existing) {
          acc.push({ origin: cr.origin, normal: cr, closure: null });
        } else if (cr.scenario?.includes("closure")) {
          existing.closure = cr;
        } else {
          existing.normal = cr;
        }
        return acc;
      }, [])
    : [];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Análisis de Tráfico</h2>
      <p className="text-xs text-white/40">
        {hourLabel(hour)} — {scenario.name} ({scenario.vehicleMultiplier}x)
      </p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Vehículos/hr" value={formatNumber(totals.total)} subtitle={`${hourLabel(hour)}`} color="#3b82f6" />
        <KPICard label="Vel. Promedio" value={`${avgSpeed} km/h`} color={avgSpeed > 25 ? "#22c55e" : "#ef4444"} />
        <KPICard label="TPD Normal" value={formatNumber(dailyNormal)} subtitle="Tráfico promedio diario" color="#60a5fa" />
        <KPICard
          label={`TPD ${scenario.label}`}
          value={formatNumber(dailyScenario)}
          subtitle={dailyDelta > 0 ? `+${formatNumber(dailyDelta)} vs normal` : "Sin diferencia"}
          color={dailyDelta > 0 ? "#f59e0b" : "#60a5fa"}
        />
      </div>

      <Card>
        <CardHeader>Volumen por Hora del Día</CardHeader>
        <CardContent>
          <TrafficHourlyChart aforos={aforos} scenario={scenario} currentHour={hour} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Composición Vehicular ({hourLabel(hour)})</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs">
            <VehicleBar label="Autos" value={totals.autos} total={totals.total} color="#3b82f6" />
            <VehicleBar label="Motos" value={totals.motos} total={totals.total} color="#22c55e" />
            <VehicleBar label="Buses" value={totals.buses} total={totals.total} color="#f59e0b" />
            <VehicleBar label="Camiones" value={totals.camiones} total={totals.total} color="#ef4444" />
            <VehicleBar label="Bicicletas" value={totals.bicicletas} total={totals.total} color="#a855f7" />
          </div>
        </CardContent>
      </Card>

      {/* OD Routes */}
      {odRoutes && odRoutes.length > 0 && (
        <Card>
          <CardHeader>Orígenes → Polígono Diamante</CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs">
              {odRoutes
                .sort((a, b) => ((b as any).volumeEventEstimated ?? 0) - ((a as any).volumeEventEstimated ?? 0))
                .map((od) => {
                  const r = od.routes?.[0];
                  if (!r) return null;
                  const mins = Math.round(r.duration / 60);
                  const km = (r.distance / 1000).toFixed(1);
                  const volEvent = (od as any).volumeEventEstimated ?? 0;
                  const pct = (od as any).volumePctEstimated ?? 0;
                  return (
                    <div key={od.origin} className="flex items-center gap-1.5 text-white/60">
                      <span className="w-16 truncate text-white/80 text-[11px]">{od.origin}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, pct * 5)}%`,
                            backgroundColor: pct >= 15 ? "#3b82f6" : pct >= 10 ? "#60a5fa" : "#93c5fd",
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-white/50 text-[10px]">{pct}%</span>
                      <span className="w-12 text-right text-white/70 font-medium">{mins} min</span>
                      <span className="w-14 text-right text-blue-400/70 text-[10px]">~{formatNumber(volEvent)} veh</span>
                    </div>
                  );
                })}
            </div>
            <p className="text-[10px] text-white/25 mt-2">
              Destino: Polígono Diamante · Volumen: estimación en día de evento (~12K veh totales)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Closure Analysis */}
      {closureAnalysis.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="text-red-400">Simulación de Cierres Viales</CardHeader>
          <CardContent>
            <p className="text-[10px] text-white/40 mb-2">
              Impacto de cierre de Cra 70 (Obelisco) en eventos tipo Clásico Paisa
            </p>
            <div className="space-y-2 text-xs">
              {closureAnalysis
                .filter((a: any) => a.normal && a.closure)
                .map((a: any) => {
                  const normalMin = Math.round((a.normal?.duration ?? 0) / 60);
                  const closureMin = Math.round((a.closure?.duration ?? 0) / 60);
                  const delta = closureMin - normalMin;
                  const pctIncrease = normalMin > 0 ? Math.round((delta / normalMin) * 100) : 0;
                  return (
                    <div key={a.origin} className="rounded border border-white/5 bg-white/[0.02] p-2">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-white/80">Desde {a.origin}</span>
                        <span className={`font-bold ${delta > 5 ? "text-red-400" : "text-amber-400"}`}>
                          +{delta} min (+{pctIncrease}%)
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-white/50">
                        <span className="text-green-400">Normal: {normalMin} min</span>
                        <span className="text-white/20">→</span>
                        <span className="text-red-400">Con cierre: {closureMin} min</span>
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Recomendación: definir ingreso al parqueadero por Cll 48 (San Juan), no por Cra 70
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          Intersecciones Monitoreadas ({aforos.length})
          <span className="text-[10px] text-white/30 font-normal ml-2">
            {aforos.filter((a) => a.source === "SIMM_oficial").length} oficiales SIMM
          </span>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60 max-h-48 overflow-y-auto">
            {aforos
              .map((a) => {
                const hv = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
                const adj = applyScenarioToTraffic(hv, scenario, hour);
                return { ...a, volume: adj.total, speed: adj.avgSpeed };
              })
              .sort((a, b) => b.volume - a.volume)
              .map((a) => (
                <div key={a.intersection} className="flex items-center justify-between gap-1">
                  <span className="truncate mr-1 flex-1">{a.intersection}</span>
                  {a.source === "SIMM_oficial" && (
                    <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded shrink-0">SIMM</span>
                  )}
                  <span className="text-white/80 whitespace-nowrap shrink-0">{formatNumber(a.volume)} veh/hr</span>
                </div>
              ))}
          </div>
          <p className="text-[10px] text-white/25 mt-2">
            Fuente oficial: SIMM Medellín (Sec. Movilidad) · Estimados: modelo de tráfico
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function VehicleBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-white/50">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-20 text-right text-white/60">{formatNumber(value)} ({Math.round(pct)}%)</span>
    </div>
  );
}
