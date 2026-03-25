"use client";

import type { Scenario } from "@/types";

interface MapLegendProps {
  scenario: Scenario;
  layerVisibility?: Record<string, boolean>;
}

export function MapLegend({ scenario, layerVisibility = {} }: MapLegendProps) {
  const vis = (id: string) => layerVisibility[id] ?? false;

  return (
    <div className="rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-black/10 dark:border-white/10 px-3 py-2 shadow-lg max-w-[200px]">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">
        Leyenda
      </div>
      <div className="space-y-1">
        {/* Always visible */}
        <LegendItem color="#10b981" label="◆ Diamante (propuesta)" shape="circle" />
        <LegendItem color="#f59e0b" label="Polígono de estudio" shape="dashed" />

        {/* Traffic */}
        <div className="border-t border-black/10 dark:border-white/10 my-1" />
        <div className="text-[9px] text-white/30 uppercase">Velocidad</div>
        <LegendItem color="#22c55e" label="> 40 km/h (libre)" />
        <LegendItem color="#eab308" label="25–40 km/h (moderado)" />
        <LegendItem color="#f97316" label="15–25 km/h (lento)" />
        <LegendItem color="#ef4444" label="< 15 km/h (congestión)" />

        {/* Polygons */}
        <div className="border-t border-black/10 dark:border-white/10 my-1" />
        <div className="text-[9px] text-white/30 uppercase">Polígonos</div>
        <LegendItem color="#22c55e" label="Complejo Deportivo" shape="square" />
        {vis("urban-comuna") && <LegendItem color="#60a5fa" label="Comuna 11 Laureles" shape="square" />}
        {vis("urban-barrios") && (
          <>
            <div className="text-[9px] text-white/30 uppercase mt-1">Demanda/Oferta por manzana</div>
            <LegendItem color="#22c55e" label="Baja (<0.5x)" shape="square" />
            <LegendItem color="#eab308" label="Moderada (0.5-1x)" shape="square" />
            <LegendItem color="#f97316" label="Alta (1-1.5x)" shape="square" />
            <LegendItem color="#ef4444" label="Crítica (>1.5x)" shape="square" />
          </>
        )}
        {vis("urban-roads") && (
          <>
            <div className="text-[9px] text-white/30 uppercase mt-1">Malla vial POT (703 seg.)</div>
            <LegendItem color="#ef4444" label="Arteria principal" />
            <LegendItem color="#f59e0b" label="Colectora" />
            <LegendItem color="#3b82f6" label="Local principal" />
          </>
        )}

        {/* POIs */}
        <div className="border-t border-black/10 dark:border-white/10 my-1" />
        <div className="text-[9px] text-white/30 uppercase">Puntos</div>
        <LegendItem color="#f59e0b" label="P  Parqueadero competidor" shape="circle" />
        {vis("commerce-restaurants") && <LegendItem color="#f97316" label="Restaurantes / Bares" shape="circle" />}
        {vis("commerce-hotels") && <LegendItem color="#a855f7" label="Hoteles" shape="circle" />}
        {vis("commerce-shops") && <LegendItem color="#06b6d4" label="Comercio" shape="circle" />}
        {vis("commerce-sports") && <LegendItem color="#22c55e" label="Deportes" shape="circle" />}
        {vis("commerce-attractions") && <LegendItem color="#f43f5e" label="Atracciones" shape="circle" />}

        {/* OD Routes */}
        {vis("traffic-od") && (
          <>
            <div className="border-t border-black/10 dark:border-white/10 my-1" />
            <div className="text-[9px] text-white/30 uppercase">Orígenes → Diamante</div>
            <LegendItem color="#f97316" label="Poblado" />
            <LegendItem color="#3b82f6" label="Centro" />
            <LegendItem color="#22c55e" label="Envigado" />
            <LegendItem color="#a855f7" label="Sabaneta" />
            <LegendItem color="#ef4444" label="Belén" />
          </>
        )}
      </div>

      <div className="mt-2 pt-1 border-t border-black/10 dark:border-white/10">
        <div className="text-[10px] text-gray-500 dark:text-white/40">
          Escenario:{" "}
          <span className="font-medium" style={{ color: scenario.color }}>
            {scenario.name}
          </span>
        </div>
        <div className="text-[9px] text-white/20 mt-0.5">
          Fuentes: Google Maps, SIMM, estimaciones
        </div>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  shape = "line",
}: {
  color: string;
  label: string;
  shape?: "line" | "circle" | "square" | "dashed";
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-white/60">
      {shape === "line" && (
        <div className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} />
      )}
      {shape === "circle" && (
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {shape === "square" && (
        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      )}
      {shape === "dashed" && (
        <div className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
      )}
      {label}
    </div>
  );
}
