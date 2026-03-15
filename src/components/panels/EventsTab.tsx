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

      {/* Asistencia real Liga BetPlay */}
      <Card>
        <CardHeader>Asistencia Real — Liga BetPlay 2024</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs text-white/60">
            <div className="flex justify-between">
              <span>Nacional (promedio/partido)</span>
              <span className="text-white/80 font-medium">30,892</span>
            </div>
            <div className="flex justify-between">
              <span>DIM (promedio/partido)</span>
              <span className="text-white/80 font-medium">16,823</span>
            </div>
            <div className="flex justify-between">
              <span>Nacional cuadrangulares</span>
              <span className="text-white/80 font-medium">34,229</span>
            </div>
            <div className="flex justify-between">
              <span>DIM cuadrangulares</span>
              <span className="text-white/80 font-medium">28,519</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white/80">
              <span>Total H1 2024 (ambos equipos)</span>
              <span className="text-green-400">603,403</span>
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              Récord histórico desde torneos cortos (2002). Mayor que Bogotá por 175,000.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Eventos recientes Atanasio */}
      <Card>
        <CardHeader>Eventos Recientes en el Atanasio</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60">
            <div className="flex justify-between"><span>Bad Bunny (ene 2026)</span><span className="text-white/80">40,000+</span></div>
            <div className="flex justify-between"><span>Shakira (feb 2025)</span><span className="text-white/80">40,000+</span></div>
            <div className="flex justify-between"><span>Maluma (abr 2025)</span><span className="text-white/80">35,000+</span></div>
            <div className="flex justify-between"><span>J Balvin (nov 2025)</span><span className="text-white/80">38,000+</span></div>
            <div className="flex justify-between"><span>Messi/Inter Miami (ene 2026)</span><span className="text-white/80">40,943</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativa venues */}
      <Card className="border-purple-500/20">
        <CardHeader className="text-purple-400">Comparativa con Venues Referencia</CardHeader>
        <CardContent>
          <div className="rounded border border-white/10 overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left p-2 text-white/50">Métrica</th>
                  <th className="text-right p-2 text-blue-400">Atanasio</th>
                  <th className="text-right p-2 text-purple-400">Movistar (BOG)</th>
                  <th className="text-right p-2 text-amber-400">Arena Primavera</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-t border-white/5">
                  <td className="p-2">Capacidad</td>
                  <td className="text-right p-2 text-white/80 font-medium">40,943</td>
                  <td className="text-right p-2 text-white/80">16,522</td>
                  <td className="text-right p-2 text-white/80">16,500</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-2">Eventos/año</td>
                  <td className="text-right p-2 text-white/80">~102</td>
                  <td className="text-right p-2 text-white/80">148</td>
                  <td className="text-right p-2 text-white/80">70 (proy.)</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-2">Asistentes/año</td>
                  <td className="text-right p-2 text-white/80">~1.2M</td>
                  <td className="text-right p-2 text-white/80">800K</td>
                  <td className="text-right p-2 text-white/80">650K (proy.)</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-2">Parking dedicado</td>
                  <td className="text-right p-2">
                    <span className="text-red-400">0</span>
                    <span className="text-white/30 mx-1">→</span>
                    <span className="text-green-400 font-semibold">1,100</span>
                  </td>
                  <td className="text-right p-2 text-white/80">~500</td>
                  <td className="text-right p-2 text-white/80">Incluido</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-2">Inversión</td>
                  <td className="text-right p-2 text-white/80">$730,000M</td>
                  <td className="text-right p-2 text-white/80">Concesión 25 años</td>
                  <td className="text-right p-2 text-white/80">$300,000M</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-2">Ubicación</td>
                  <td className="text-right p-2 text-white/80">Medellín C11</td>
                  <td className="text-right p-2 text-white/80">Bogotá</td>
                  <td className="text-right p-2 text-white/80">Sabaneta (dic 2026)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 p-2">
            <p className="text-[10px] text-red-400 font-medium mb-0.5">Problema crítico de parking</p>
            <p className="text-[10px] text-white/50">
              El Atanasio tiene 40,943 personas de capacidad y <span className="text-red-400 font-bold">cero celdas de parking formal</span>.
              Los &quot;trapitos rojos&quot; cobran ~$10,000/carro en vía pública. El Diamante resuelve esto con 1,100 celdas.
            </p>
          </div>
          <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2">
            <p className="text-[10px] text-amber-400 font-medium mb-0.5">Arena Primavera valida el mercado</p>
            <p className="text-[10px] text-white/50">
              A&B Investments (operador Movistar Arena Bogotá) invierte $300,000M en Arena Primavera en Sabaneta.
              El mismo grupo que genera $500,000M/año de impacto económico en Bogotá está apostando por el mercado de Medellín.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
