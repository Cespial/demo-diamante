"use client";

import type { Scenario, ParkingPOI } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { ParkingSupplyDemand } from "@/components/charts/ParkingSupplyDemand";
import { useData } from "@/lib/hooks";
import { formatNumber, formatCOP, hourLabel } from "@/lib/utils";
import { getParkingDemand, getTariff } from "@/lib/scenario-engine";
import { DEFAULT_FINANCIAL_PARAMS } from "@/data/financial-params";
import { ATTRACTION_FACTOR_DEFAULT } from "@/data/diamante-config";
import { Skeleton } from "@/components/ui/Skeleton";

interface ParkingTabProps {
  scenario: Scenario;
  hour: number;
}

export function ParkingTab({ scenario, hour }: ParkingTabProps) {
  const { data: parking, loading } = useData<ParkingPOI[]>("/data/parking-pois.json");

  const diamanteSpaces = DEFAULT_FINANCIAL_PARAMS.parkingSpaces; // 1,100
  const competitorSpaces = parking?.reduce((s, p) => s + p.capacity, 0) ?? 0;
  const totalSupply = competitorSpaces + diamanteSpaces;
  const attractionFactor = ATTRACTION_FACTOR_DEFAULT;

  const { demand, occupancy, overflow } = getParkingDemand(
    scenario, hour, totalSupply, 0, attractionFactor
  );
  const tariff = getTariff(scenario, hour, DEFAULT_FINANCIAL_PARAMS.baseTariff, DEFAULT_FINANCIAL_PARAMS.maxTariff);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Análisis de Parqueaderos</h2>
      <p className="text-xs text-white/40">{hourLabel(hour)} — {scenario.name}</p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard
          label="Demanda Estimada"
          value={formatNumber(demand)}
          subtitle={`${Math.round(occupancy * 100)}% de oferta total (${formatNumber(totalSupply)})`}
          color={overflow ? "#ef4444" : "#f59e0b"}
        />
        <KPICard
          label="Oferta Total Zona"
          value={formatNumber(totalSupply)}
          subtitle={`Competencia ${formatNumber(competitorSpaces)} + Diamante ${formatNumber(diamanteSpaces)}`}
          color="#22c55e"
        />
        <KPICard
          label="Competencia (1.5km)"
          value={formatNumber(competitorSpaces)}
          subtitle={`${parking?.length ?? 0} parqueaderos`}
          color="#a855f7"
        />
        <KPICard
          label="Tarifa Actual"
          value={formatCOP(tariff)}
          subtitle={`Surcharge: ${scenario.surchargeMultiplier}x`}
          color="#3b82f6"
        />
      </div>

      <Card>
        <CardHeader>Demanda vs Oferta por Hora</CardHeader>
        <CardContent>
          <ParkingSupplyDemand
            scenario={scenario}
            totalSupply={totalSupply}
            competitorSupply={competitorSpaces}
            currentHour={hour}
            attractionFactor={attractionFactor}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Parqueaderos Competidores</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
            {parking?.sort((a, b) => b.capacity - a.capacity).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-white/60">
                <span className="truncate mr-2 flex-1">{p.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {p.rating && <span className="text-yellow-400 text-[10px]">{p.rating}</span>}
                  <span className="text-white/80 whitespace-nowrap">{p.capacity} celdas</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Valet scheme */}
      {parking && parking.some((p) => p.walkingTimeSeconds) && (
        <Card>
          <CardHeader>Esquema Valet — Parqueaderos Aliados</CardHeader>
          <CardContent>
            <p className="text-[10px] text-white/40 mb-2">
              En eventos con overflow (&gt;1,100 celdas), operar valet con parqueaderos a 500-700m
            </p>
            <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
              {parking
                .filter((p) => p.walkingTimeSeconds && p.walkingTimeSeconds < 600)
                .sort((a, b) => (a.walkingTimeSeconds ?? 999) - (b.walkingTimeSeconds ?? 999))
                .slice(0, 8)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-white/60">
                    <span className="truncate mr-2 flex-1">{p.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-blue-400">
                        {Math.round((p.walkingTimeSeconds ?? 0) / 60)} min
                      </span>
                      <span className="text-white/40">
                        {p.walkingDistanceMeters}m
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Diamante — Propuesta de Valor</CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-white/60 list-disc list-inside">
            <li>{formatNumber(diamanteSpaces)} celdas en 2 sótanos bajo nivel de cancha</li>
            <li>Tarifa dinámica: $5,000 base → hasta $15,000 en eventos</li>
            <li>Referencia zona: Obelisco $27,000/día (~$4,500/hr)</li>
            <li>Servicio valet en eventos grandes (+$15K/servicio)</li>
            {overflow && (
              <li className="text-red-400 font-medium">
                Demanda estimada supera oferta total — oportunidad de precios premium
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
