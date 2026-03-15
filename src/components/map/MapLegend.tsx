"use client";

import type { Scenario } from "@/types";

interface MapLegendProps {
  scenario: Scenario;
}

export function MapLegend({ scenario }: MapLegendProps) {
  return (
    <div className="rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-black/10 dark:border-white/10 px-3 py-2 shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">
        Leyenda
      </div>
      <div className="space-y-1">
        <LegendItem color="#22c55e" label="Flujo libre (>40 km/h)" />
        <LegendItem color="#eab308" label="Moderado (25-40 km/h)" />
        <LegendItem color="#f97316" label="Lento (15-25 km/h)" />
        <LegendItem color="#ef4444" label="Congestionado (<15 km/h)" />
        <div className="border-t border-black/10 dark:border-white/10 my-1" />
        <LegendItem color="#3b82f6" label="Diamante (3D)" shape="square" />
        <LegendItem color="#22c55e" label="Complejo Deportivo" shape="square" />
        <LegendItem color="#f59e0b" label="Parqueaderos" shape="circle" />
      </div>
      <div className="mt-2 pt-1 border-t border-black/10 dark:border-white/10">
        <div className="text-[10px] text-gray-500 dark:text-white/40">
          Escenario:{" "}
          <span className="font-medium" style={{ color: scenario.color }}>
            {scenario.name}
          </span>
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
  shape?: "line" | "circle" | "square";
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
      {label}
    </div>
  );
}
