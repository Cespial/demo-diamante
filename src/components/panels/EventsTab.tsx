"use client";

import type { Scenario, CalendarEvent, HotelOccupancy } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { EventImpactChart } from "@/components/charts/EventImpactChart";
import { HotelOccupancyChart } from "@/components/charts/HotelOccupancyChart";
import { useData } from "@/lib/hooks";
import { formatNumber, formatCOP } from "@/lib/utils";
import { SCENARIOS } from "@/data/scenarios";
import { Skeleton } from "@/components/ui/Skeleton";

interface EventsTabProps {
  scenario: Scenario;
}

export function EventsTab({ scenario }: EventsTabProps) {
  const { data: events, loading: loadE } = useData<CalendarEvent[]>("/data/events-calendar.json");
  const { data: occupancy, loading: loadO } = useData<HotelOccupancy[]>("/data/hotel-occupancy-events.json");

  if (loadE || !events) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const totalEvents = events.length;
  const totalAttendance = events.reduce((s, e) => s + e.attendance, 0);
  const avgAttendance = totalEvents > 0 ? Math.round(totalAttendance / totalEvents) : 0;

  const typeCount: Record<string, number> = {};
  events.forEach((e) => {
    typeCount[e.type] = (typeCount[e.type] ?? 0) + 1;
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Calendario de Eventos</h2>
      <p className="text-xs text-white/40">
        Impacto en tráfico, parking y comercio
      </p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Eventos/Año" value={String(totalEvents)} color="#3b82f6" />
        <KPICard label="Asistencia Total" value={formatNumber(totalAttendance)} color="#22c55e" />
        <KPICard label="Asistencia Prom." value={formatNumber(avgAttendance)} color="#f59e0b" />
        <KPICard
          label="Surcharge Estimado"
          value={formatCOP(totalEvents * 8_000_000)}
          subtitle="~$8M COP uplift/evento"
          color="#a855f7"
        />
      </div>

      <Card>
        <CardHeader>Impacto por Tipo de Evento</CardHeader>
        <CardContent>
          <EventImpactChart />
        </CardContent>
      </Card>

      {occupancy && (
        <Card>
          <CardHeader>Ocupación Hotelera Mensual</CardHeader>
          <CardContent>
            <HotelOccupancyChart data={occupancy} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Distribución por Tipo</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs">
            {Object.entries(typeCount).map(([type, count]) => {
              const s = SCENARIOS[type as keyof typeof SCENARIOS];
              return (
                <div key={type} className="flex items-center justify-between text-white/60">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color ?? "#64748b" }} />
                    <span>{s?.name ?? type}</span>
                  </div>
                  <span className="text-white/80">{count} eventos/año</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Próximos Eventos (Ejemplo)</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60 max-h-40 overflow-y-auto">
            {events.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between">
                <span className="truncate mr-2">{e.name}</span>
                <span className="text-white/40 whitespace-nowrap">{formatNumber(e.attendance)} pers.</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
