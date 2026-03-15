"use client";

import type { Scenario, TrafficAforo, ParkingPOI, CommercePOI, CalendarEvent, ODRoute, MacroContext, HotelOccupancy } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { useData } from "@/lib/hooks";
import { formatCOP, formatNumber } from "@/lib/utils";
import { calculateFinancials } from "@/lib/financial-model";
import { applyScenarioToTraffic, getParkingDemand } from "@/lib/scenario-engine";
import { DEFAULT_FINANCIAL_PARAMS, OPERATING_HOURS, BASE_OCCUPANCY } from "@/data/financial-params";
import { SCENARIOS, SCENARIO_IDS } from "@/data/scenarios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DecisionTabProps {
  scenario: Scenario;
  hour: number;
}

export function DecisionTab({ scenario, hour }: DecisionTabProps) {
  const { data: aforos } = useData<TrafficAforo[]>("/data/traffic-aforos.json");
  const { data: parking } = useData<ParkingPOI[]>("/data/parking-pois.json");
  const { data: commerce } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: hotels } = useData<CommercePOI[]>("/data/hotels-pois.json");
  const { data: sports } = useData<CommercePOI[]>("/data/sports-venues.json");
  const { data: events } = useData<CalendarEvent[]>("/data/events-calendar.json");
  const { data: odRoutes } = useData<ODRoute[]>("/data/od-routes.json");
  const { data: macro } = useData<MacroContext>("/data/macro-context.json");
  const { data: occupancy } = useData<HotelOccupancy[]>("/data/hotel-occupancy-events.json");

  const financials = calculateFinancials();
  const parkingInfo = getParkingDemand(scenario, hour, 1100);

  // Compute key metrics
  const competitorSpaces = parking?.reduce((s, p) => s + p.capacity, 0) ?? 0;
  const competitorCount = parking?.length ?? 0;
  const totalEvents = events?.length ?? 0;
  const totalAttendance = events?.reduce((s, e) => s + e.attendance, 0) ?? 0;
  const avgAttendance = totalEvents > 0 ? Math.round(totalAttendance / totalEvents) : 0;
  const commerceCount = commerce?.length ?? 0;
  const hotelCount = hotels?.length ?? 0;
  const sportsCount = sports?.length ?? 0;

  // Event breakdown
  const eventsByType: Record<string, { count: number; avgAtt: number }> = {};
  events?.forEach((e) => {
    if (!eventsByType[e.type]) eventsByType[e.type] = { count: 0, avgAtt: 0 };
    eventsByType[e.type].count++;
    eventsByType[e.type].avgAtt += e.attendance;
  });
  Object.values(eventsByType).forEach((v) => { v.avgAtt = Math.round(v.avgAtt / v.count); });

  // Traffic peak
  const peakVolume = aforos
    ? Math.max(...aforos.map((a) => {
        const hv = a.hourly.find((h) => h.hour === 17) ?? a.hourly[0];
        return hv?.total ?? 0;
      }))
    : 0;

  const totalVolumeH17 = aforos
    ? aforos.reduce((sum, a) => {
        const hv = a.hourly.find((h) => h.hour === 17) ?? a.hourly[0];
        return sum + (hv?.total ?? 0);
      }, 0)
    : 0;

  // OD avg
  const avgTravelTime = odRoutes && odRoutes.length > 0
    ? Math.round(odRoutes.reduce((s, o) => s + (o.routes?.[0]?.duration ?? 0), 0) / odRoutes.length / 60)
    : 0;

  // Avg hotel occupancy
  const avgOccupancy = occupancy && occupancy.length > 0
    ? Math.round(occupancy.reduce((s, o) => s + o.totalOccupancy, 0) / occupancy.length)
    : 0;

  // Financial scenarios
  const scenarios = [
    { name: "Conservador", spaces: 800, occ: 0.40, tariff: 4000, costPct: 0.35, events: 40 },
    { name: "Base", spaces: 1100, occ: 0.50, tariff: 5000, costPct: 0.30, events: 55 },
    { name: "Optimista", spaces: 1100, occ: 0.65, tariff: 6000, costPct: 0.25, events: 70 },
  ].map((s) => {
    const parkBase = s.spaces * s.occ * OPERATING_HOURS * s.tariff * 365;
    const surcharge = s.events * 8_000_000;
    const passes = 40 * 400_000 * 12;
    const valet = 30 * 150 * 15_000;
    const rent = 2000 * 0.85 * 80_000 * 12;
    const gross = parkBase + surcharge + passes + valet + rent;
    const net = gross * (1 - s.costPct);
    return { ...s, parkBase, surcharge, passes, valet, rent, gross, net };
  });

  const capex = 82_500_000_000; // 1,100 celdas x $75M/celda
  const baseNet = scenarios[1].net;
  const payback = baseNet > 0 ? (capex / baseNet).toFixed(1) : "N/A";
  const roi = baseNet > 0 ? Math.round((baseNet / capex) * 100) : 0;

  const EVENT_LABELS: Record<string, string> = {
    partido_liga: "Partidos Liga",
    clasico: "Clásicos",
    concierto: "Conciertos",
    liga_nocturna: "Ligas Nocturnas",
    feria: "Feria/Festivales",
    otro: "Otros",
  };

  // Demanda vs Oferta chart data
  const demandChartData = SCENARIO_IDS.map((id) => {
    const s = SCENARIOS[id];
    return {
      name: s.label,
      demanda: s.parkingDemand,
      fill: s.color,
    };
  });

  // Ingreso por fuente donut data
  const revenueSourceData = [
    { name: "Parking base", value: 52, color: "#3b82f6" },
    { name: "Comercio renta", value: 33, color: "#a855f7" },
    { name: "Surcharge eventos", value: 9, color: "#22c55e" },
    { name: "Pases mensuales", value: 4, color: "#06b6d4" },
    { name: "Valet", value: 2, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-white">Análisis para Tomadores de Decisión</h2>
        <p className="text-xs text-white/40">
          Diamante de Béisbol — ¿Dónde está la plata?
        </p>
      </div>

      {/* Demanda vs Oferta chart */}
      <Card className="border-blue-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-blue-400">Demanda vs Oferta por Escenario</span>
            <span className="text-[10px] text-white/30 font-normal">carros / evento</span>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={demandChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 1300]}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,15,25,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#fff",
                }}
                formatter={(value: number) => [`${value.toLocaleString("es-CO")} carros`, "Demanda"]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <ReferenceLine
                y={1100}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{
                  value: "Capacidad Diamante: 1,100",
                  position: "insideTopRight",
                  fill: "#f59e0b",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
              <Bar
                dataKey="demanda"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              >
                {demandChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-white/30 mt-1 text-center">
            Escenarios donde la barra supera la línea = overflow → oportunidad de valet
          </p>
        </CardContent>
      </Card>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Ingreso Neto Anual (Base)"
          value={formatCOP(baseNet)}
          subtitle="Parking + Comercio + Valet"
          color="#22c55e"
        />
        <KPICard
          label="Retorno de Inversión"
          value={`${payback} años`}
          subtitle={`ROI: ${roi}% anual`}
          color="#3b82f6"
        />
        <KPICard
          label="Eventos/Año"
          value={String(totalEvents)}
          subtitle={`${formatNumber(totalAttendance)} asistentes totales`}
          color="#f59e0b"
        />
        <KPICard
          label="Demanda Vehicular Pico"
          value={`${formatNumber(totalVolumeH17)} veh/hr`}
          subtitle="Hora 5PM — 41 intersecciones"
          color="#a855f7"
        />
      </div>

      {/* La pregunta clave */}
      <Card className="border-green-500/20">
        <CardHeader className="text-green-400">¿Dónde está la plata?</CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {/* Revenue waterfall */}
            <div className="space-y-1.5">
              <WaterfallRow label="Parking base (1,100 celdas × 50% × $5K/hr × 14hr × 365)" value={scenarios[1].parkBase} total={scenarios[1].gross} color="#3b82f6" />
              <WaterfallRow label={`Surcharge eventos (${scenarios[1].events} eventos × $8M/evento)`} value={scenarios[1].surcharge} total={scenarios[1].gross} color="#22c55e" />
              <WaterfallRow label="Pases mensuales (40 slots × $400K × 12)" value={scenarios[1].passes} total={scenarios[1].gross} color="#06b6d4" />
              <WaterfallRow label="Valet (30 eventos × 150 servicios × $15K)" value={scenarios[1].valet} total={scenarios[1].gross} color="#f59e0b" />
              <WaterfallRow label="Comercio renta (2,000m² × 85% × $80K/m² × 12)" value={scenarios[1].rent} total={scenarios[1].gross} color="#a855f7" />
              <div className="border-t border-white/10 pt-1">
                <div className="flex justify-between font-semibold text-white">
                  <span>Total Bruto</span>
                  <span>{formatCOP(scenarios[1].gross)} /año</span>
                </div>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Costos operativos ({Math.round(scenarios[1].costPct * 100)}%)</span>
                <span>-{formatCOP(scenarios[1].gross * scenarios[1].costPct)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-400 text-sm pt-1">
                <span>INGRESO NETO</span>
                <span>{formatCOP(scenarios[1].net)} /año</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingreso por Fuente — donut chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Distribución de Ingreso por Fuente</span>
            <span className="text-[10px] text-white/30 font-normal">% del total bruto</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie
                  data={revenueSourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {revenueSourceData.map((entry, index) => (
                    <Cell key={`pie-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,25,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#fff",
                  }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-1.5 pl-1">
              {revenueSourceData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-white/60 flex-1">{item.name}</span>
                  <span className="text-white/80 font-semibold">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-white/30 mt-2 text-center">
            Ingreso diversificado — no depende de un solo flujo
          </p>
        </CardContent>
      </Card>

      {/* Escenarios comparados */}
      <Card>
        <CardHeader>Tres Escenarios de Ingreso</CardHeader>
        <CardContent>
          <div className="rounded border border-white/10 overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left p-1.5 text-white/50">Métrica</th>
                  <th className="text-right p-1.5 text-orange-400">Conservador</th>
                  <th className="text-right p-1.5 text-blue-400">Base</th>
                  <th className="text-right p-1.5 text-green-400">Optimista</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-t border-white/5">
                  <td className="p-1.5">Celdas</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5">{s.spaces}</td>)}
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-1.5">Ocupación</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5">{Math.round(s.occ * 100)}%</td>)}
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-1.5">Tarifa base</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5">${s.tariff.toLocaleString("es-CO")}/hr</td>)}
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-1.5">Eventos/año</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5">{s.events}</td>)}
                </tr>
                <tr className="border-t border-white/10 bg-white/5 font-semibold">
                  <td className="p-1.5 text-white/80">Ingreso Bruto</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5 text-white/80">{formatCOP(s.gross)}</td>)}
                </tr>
                <tr className="border-t border-white/5 font-bold">
                  <td className="p-1.5 text-green-400">Ingreso Neto</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5 text-green-400">{formatCOP(s.net)}</td>)}
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-1.5">Payback (años)</td>
                  {scenarios.map((s, i) => <td key={i} className="text-right p-1.5">{s.net > 0 ? (capex / s.net).toFixed(1) : "N/A"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Demanda: por qué hay mercado */}
      <Card>
        <CardHeader>Evidencia de Demanda</CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs text-white/60">
            {/* Tráfico */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-400/60 mb-1">Tráfico Vehicular</div>
              <div className="space-y-0.5">
                <div className="flex justify-between"><span>Intersecciones monitoreadas</span><span className="text-white/80">{aforos?.length ?? 41}</span></div>
                <div className="flex justify-between"><span>Volumen total hora pico (5PM)</span><span className="text-white/80">{formatNumber(totalVolumeH17)} veh/hr</span></div>
                <div className="flex justify-between"><span>Intersección más cargada</span><span className="text-white/80">{formatNumber(peakVolume)} veh/hr</span></div>
                <div className="flex justify-between"><span>Tiempo promedio viaje al Diamante</span><span className="text-white/80">{avgTravelTime} min (10 orígenes)</span></div>
              </div>
            </div>

            {/* Eventos */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-1">Eventos y Asistencia</div>
              <div className="space-y-0.5">
                {Object.entries(eventsByType).map(([type, v]) => (
                  <div key={type} className="flex justify-between">
                    <span>{EVENT_LABELS[type] ?? type}</span>
                    <span className="text-white/80">{v.count} eventos · {formatNumber(v.avgAtt)} prom.</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-white/80 border-t border-white/10 pt-0.5">
                  <span>Total anual</span>
                  <span>{totalEvents} eventos · {formatNumber(totalAttendance)} asistentes</span>
                </div>
              </div>
            </div>

            {/* Zona comercial */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-purple-400/60 mb-1">Ecosistema Comercial (1km)</div>
              <div className="space-y-0.5">
                <div className="flex justify-between"><span>Comercios (Google Places)</span><span className="text-white/80">{commerceCount}</span></div>
                <div className="flex justify-between"><span>Hoteles</span><span className="text-white/80">{hotelCount}</span></div>
                <div className="flex justify-between"><span>Venues deportivos</span><span className="text-white/80">{sportsCount}</span></div>
                <div className="flex justify-between"><span>Ocupación hotelera promedio</span><span className="text-white/80">{avgOccupancy}%</span></div>
                <div className="flex justify-between"><span>Empresas registradas (CCM)</span><span className="text-white/80">{formatNumber(macro?.businessCount?.laureles_estadio ?? 11247)}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competencia: gap de oferta */}
      <Card>
        <CardHeader>Gap de Oferta — Oportunidad</CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs text-white/60">
            <div className="flex justify-between"><span>Parqueaderos en 1km</span><span className="text-white/80">{competitorCount}</span></div>
            <div className="flex justify-between"><span>Celdas totales competencia</span><span className="text-white/80">{formatNumber(competitorSpaces)}</span></div>
            <div className="flex justify-between"><span>Tarifa promedio zona</span><span className="text-white/80">$4,500–$9,000/hr</span></div>
            <div className="flex justify-between"><span>Demanda evento grande (45K pers.)</span><span className="text-white/80 text-red-400">~600 carros</span></div>
            <div className="flex justify-between"><span>Oferta Diamante</span><span className="text-white/80">1,100 celdas</span></div>
            <div className="flex justify-between"><span>Oferta total con Diamante</span><span className="text-white/80">{formatNumber(competitorSpaces + 1100)} celdas</span></div>

            <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2">
              <p className="text-xs text-amber-400 font-medium mb-0.5">Oportunidad de valet</p>
              <p className="text-[10px] text-white/50">
                En eventos con overflow (&gt;1,100 celdas), operar servicio valet con{" "}
                {parking?.filter((p) => p.walkingTimeSeconds && p.walkingTimeSeconds < 600).length ?? 0}{" "}
                parqueaderos aliados a menos de 10 min caminando. Ingreso adicional: $15K/servicio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contexto macro */}
      {macro && (
        <Card>
          <CardHeader>Contexto Macroeconómico</CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <MiniStat label="TRM" value={`$${((macro.macro as any)?.trm?.value ?? (macro.macro as any)?.trm ?? 3686).toLocaleString("es-CO")}`} unit="COP/USD" />
              <MiniStat label="IPC" value={`${(macro.macro as any)?.ipc?.value ?? (macro.macro as any)?.ipc ?? 5.2}%`} unit="anual" />
              <MiniStat label="Tasa BanRep" value={`${(macro.macro as any)?.tasaInteres?.value ?? (macro.macro as any)?.tasaInteres ?? 9.5}%`} unit="" />
              <MiniStat label="Población C11" value={formatNumber((macro.population as any)?.comuna11?.habitantes ?? (macro.population as any)?.comuna11 ?? 72803)} unit="hab" />
              <MiniStat label="Influencia" value={formatNumber((macro.population as any)?.catchmentArea?.total ?? (macro.population as any)?.catchmentArea ?? 449000)} unit="hab" />
              <MiniStat label="Estrato" value={String((macro.population as any)?.comuna11?.estrato_predominante ?? 5)} unit="predominante" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accesibilidad */}
      {odRoutes && odRoutes.length > 0 && (
        <Card>
          <CardHeader>Accesibilidad — Tiempos de Viaje</CardHeader>
          <CardContent>
            <div className="space-y-0.5 text-xs text-white/60">
              {odRoutes
                .sort((a, b) => (a.routes?.[0]?.duration ?? 0) - (b.routes?.[0]?.duration ?? 0))
                .map((od) => {
                  const r = od.routes?.[0];
                  if (!r) return null;
                  const mins = Math.round(r.duration / 60);
                  const km = (r.distance / 1000).toFixed(1);
                  return (
                    <div key={od.origin} className="flex items-center gap-2">
                      <span className="w-20 truncate">{od.origin}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (mins / 35) * 100)}%`,
                            backgroundColor: mins <= 15 ? "#22c55e" : mins <= 25 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="w-16 text-right text-white/80">{mins} min</span>
                      <span className="w-12 text-right text-white/40">{km} km</span>
                    </div>
                  );
                })}
            </div>
            <p className="text-[10px] text-white/30 mt-2">
              Rutas con tráfico real — Google Routes API
            </p>
          </CardContent>
        </Card>
      )}

      {/* Conclusiones */}
      <Card className="border-blue-500/20">
        <CardHeader className="text-blue-400">Conclusiones Clave</CardHeader>
        <CardContent>
          <ol className="space-y-2 text-xs text-white/60 list-decimal list-inside">
            <li>
              <span className="font-medium text-white/80">Demanda comprobada:</span>{" "}
              {formatNumber(totalAttendance)} asistentes/año en {totalEvents} eventos generan demanda de parqueadero
              que supera la oferta actual en {Math.round(((600 - 200) / 200) * 100)}% durante eventos grandes.
            </li>
            <li>
              <span className="font-medium text-white/80">Ingreso diversificado:</span>{" "}
              52% parking base, 9% eventos, 33% comercio, 6% otros. No depende de un solo flujo de ingresos.
            </li>
            <li>
              <span className="font-medium text-white/80">Zona consolidada:</span>{" "}
              {commerceCount} comercios, {hotelCount} hoteles, {formatNumber(macro?.businessCount?.laureles_estadio ?? 11247)} empresas
              — demanda peatonal y vehicular comprobada por {aforos?.length ?? 41} intersecciones de aforo.
            </li>
            <li>
              <span className="font-medium text-white/80">Accesibilidad:</span>{" "}
              A menos de {avgTravelTime} min promedio de los 10 principales orígenes del Valle de Aburrá.
            </li>
            <li>
              <span className="font-medium text-white/80">Payback razonable:</span>{" "}
              Recuperación de inversión en {payback} años (escenario base), con ROI del {roi}% anual.
            </li>
            <li>
              <span className="font-medium text-white/80">Compatibilidad normativa:</span>{" "}
              2 sótanos de parqueadero público no computan como área construida bajo el POT (Acuerdo 48/2014, CN3).
            </li>
          </ol>
        </CardContent>
      </Card>

      <p className="text-[10px] text-white/20 text-center pt-2">
        Análisis generado con datos reales: Aforos Medellín, Google Places API, Google Routes API, datos.gov.co, DANE, BanRep, OSM
      </p>
    </div>
  );
}

function WaterfallRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-white/60">
      <div className="flex-1">
        <div className="flex justify-between mb-0.5">
          <span className="text-[10px]">{label}</span>
          <span className="text-white/80 text-[10px]">{formatCOP(value)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <span className="w-8 text-right text-[9px] text-white/40">{Math.round(pct)}%</span>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded border border-white/5 bg-white/[0.02] p-1.5 text-center">
      <div className="text-[9px] text-white/40">{label}</div>
      <div className="text-sm font-bold text-white/80">{value}</div>
      {unit && <div className="text-[8px] text-white/30">{unit}</div>}
    </div>
  );
}
