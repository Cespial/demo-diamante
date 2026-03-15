"use client";

import type { Scenario, CommercePOI, TrafficIncident } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { useData } from "@/lib/hooks";
import { formatNumber, hourLabel } from "@/lib/utils";
import { getPedestrianFlow } from "@/lib/scenario-engine";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface PersonasTabProps {
  scenario: Scenario;
  hour: number;
}

export function PersonasTab({ scenario, hour }: PersonasTabProps) {
  const { data: commerce, loading: loadC } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: hotels } = useData<CommercePOI[]>("/data/hotels-pois.json");
  const { data: incidents } = useData<TrafficIncident[]>("/data/incidents-laureles.json");

  if (loadC || !commerce) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const currentFlow = getPedestrianFlow(scenario, hour);
  const flowIndex = Math.min(10, Math.round(currentFlow * 2.5));

  // Count businesses open at current hour
  const openNow = commerce.filter((c) => {
    if (!c.openingHours || c.openingHours.length === 0) return true; // assume open if no data
    return true; // simplified — Google opening hours parsing would go here
  }).length;

  // Restaurants/bars = nightlife proxy
  const nightlifeCount = commerce.filter((c) =>
    ["bar", "restaurant", "cafe"].includes(c.category)
  ).length;

  // Build hourly flow chart
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const flow = getPedestrianFlow(scenario, h);
    return {
      hour: hourLabel(h),
      hourNum: h,
      intensity: Math.round(flow * 100) / 100,
      index: Math.min(10, Math.round(flow * 2.5)),
    };
  });

  // Incident density as a proxy for pedestrian activity
  const incidentsByHour = new Array(24).fill(0);
  incidents?.forEach((inc) => {
    if (inc.hour >= 0 && inc.hour < 24) incidentsByHour[inc.hour]++;
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Flujo Peatonal</h2>
      <p className="text-xs text-white/40">
        {hourLabel(hour)} — {scenario.name}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Índice de Intensidad"
          value={`${flowIndex}/10`}
          subtitle={flowIndex >= 7 ? "Alta actividad" : flowIndex >= 4 ? "Actividad moderada" : "Baja actividad"}
          color={flowIndex >= 7 ? "#ef4444" : flowIndex >= 4 ? "#f59e0b" : "#22c55e"}
        />
        <KPICard
          label="Comercios Activos"
          value={formatNumber(openNow)}
          subtitle="En radio de 1km"
          color="#3b82f6"
        />
        <KPICard
          label="Restaurantes/Bares"
          value={String(nightlifeCount)}
          subtitle="Actividad nocturna"
          color="#f97316"
        />
        <KPICard
          label="Hoteles Cercanos"
          value={String(hotels?.length ?? 0)}
          subtitle="Turismo + demand parking"
          color="#a855f7"
        />
      </div>

      <Card>
        <CardHeader>Intensidad Peatonal por Hora</CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#ffffff60" }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} domain={[0, 10]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
              />
              <Area type="monotone" dataKey="index" stroke="#f97316" fill="url(#flowGrad)" strokeWidth={2} name="Índice" />
              <ReferenceLine x={hourLabel(hour)} stroke="#ffffff40" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Incidentes por Hora (Proxy de Flujo)</CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart
              data={incidentsByHour.map((count, h) => ({ hour: hourLabel(h), count }))}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#ffffff60" }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="count" stroke="#ef4444" fill="#ef444420" strokeWidth={1.5} name="Incidentes" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-white/30 mt-1">
            {formatNumber(incidents?.length ?? 0)} incidentes reales (2019-2020) — más incidentes = más flujo vehicular y peatonal
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Patrones de Actividad</CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs text-white/60">
            <PatternRow
              label="Mañana (6-9am)"
              desc="Flujo residencial hacia trabajo/estudio"
              intensity={3}
            />
            <PatternRow
              label="Mediodía (12-2pm)"
              desc="Pico almuerzo — restaurantes, comercio"
              intensity={6}
            />
            <PatternRow
              label="Tarde (5-7pm)"
              desc="Regreso a casa + pre-evento"
              intensity={8}
            />
            <PatternRow
              label="Noche (7-10pm)"
              desc="Ligas deportivas, bares, restaurantes"
              intensity={scenario.id === "normal" ? 5 : 9}
            />
            <PatternRow
              label="Evento activo"
              desc={scenario.name}
              intensity={scenario.id === "normal" ? 0 : Math.round(scenario.attendance / 5000)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Demanda Peatonal Recurrente</CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-white/60 list-disc list-inside">
            <li>Ligas nocturnas (L-V 7-10pm): taekwondo, tenis, atletismo, trote — {" "}
              <span className="text-blue-400">~500 personas/noche</span>
            </li>
            <li>Zona gastronómica Laureles: {nightlifeCount} restaurantes/bares generan flujo continuo</li>
            <li>Hotelería turismo médico (Cra 76-80): {hotels?.length ?? 0} establecimientos</li>
            <li>Estrato 5 residencial: población cautiva de {formatNumber(72803)} hab (Comuna 11)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PatternRow({ label, desc, intensity }: { label: string; desc: string; intensity: number }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="font-medium text-white/80">{label}</span>
        <span className="text-white/50">{intensity}/10</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${intensity * 10}%`,
              backgroundColor: intensity >= 7 ? "#ef4444" : intensity >= 4 ? "#f59e0b" : "#22c55e",
            }}
          />
        </div>
        <span className="text-[10px] text-white/40 w-32 text-right">{desc}</span>
      </div>
    </div>
  );
}
