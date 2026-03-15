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
        <KPICard label="Vehículos/hr" value={formatNumber(totals.total)} color="#3b82f6" />
        <KPICard label="Vel. Promedio" value={`${avgSpeed} km/h`} color={avgSpeed > 25 ? "#22c55e" : "#ef4444"} />
        <KPICard label="Autos" value={formatNumber(totals.autos)} color="#60a5fa" />
        <KPICard label="Motos" value={formatNumber(totals.motos)} color="#34d399" />
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
          <CardHeader>Orígenes y Destinos — ¿De dónde vienen?</CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {odRoutes
                .sort((a, b) => (a.routes?.[0]?.duration ?? 0) - (b.routes?.[0]?.duration ?? 0))
                .map((od) => {
                  const r = od.routes?.[0];
                  if (!r) return null;
                  const mins = Math.round(r.duration / 60);
                  const km = (r.distance / 1000).toFixed(1);
                  return (
                    <div key={od.origin} className="flex items-center gap-2 text-white/60">
                      <span className="w-20 truncate text-white/80">{od.origin}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (mins / 35) * 100)}%`,
                            backgroundColor: mins <= 15 ? "#22c55e" : mins <= 25 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-white/70 font-medium">{mins} min</span>
                      <span className="w-12 text-right text-white/40">{km} km</span>
                    </div>
                  );
                })}
            </div>
            <p className="text-[10px] text-white/25 mt-2">Google Routes API — tráfico real</p>
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
        <CardHeader>Intersecciones Monitoreadas ({aforos.length})</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60 max-h-40 overflow-y-auto">
            {aforos
              .map((a) => {
                const hv = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
                const adj = applyScenarioToTraffic(hv, scenario, hour);
                return { ...a, volume: adj.total, speed: adj.avgSpeed };
              })
              .sort((a, b) => b.volume - a.volume)
              .map((a) => (
                <div key={a.intersection} className="flex justify-between">
                  <span className="truncate mr-2">{a.intersection}</span>
                  <span className="text-white/80 whitespace-nowrap">{formatNumber(a.volume)} veh/hr</span>
                </div>
              ))}
          </div>
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
