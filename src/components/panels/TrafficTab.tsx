"use client";

import type { Scenario, TrafficAforo } from "@/types";
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

      <Card>
        <CardHeader>Intersecciones Monitoreadas</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60 max-h-40 overflow-y-auto">
            {aforos.map((a) => {
              const hv = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
              const adj = applyScenarioToTraffic(hv, scenario, hour);
              return (
                <div key={a.intersection} className="flex justify-between">
                  <span className="truncate mr-2">{a.intersection}</span>
                  <span className="text-white/80 whitespace-nowrap">{formatNumber(adj.total)} veh/hr</span>
                </div>
              );
            })}
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
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 text-right text-white/60">{Math.round(pct)}%</span>
    </div>
  );
}
