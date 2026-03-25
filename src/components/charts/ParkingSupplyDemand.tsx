"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Scenario } from "@/types";
import { getParkingDemand } from "@/lib/scenario-engine";
import { hourLabel, formatNumber } from "@/lib/utils";

interface ParkingSupplyDemandProps {
  scenario: Scenario;
  totalSupply: number;
  competitorSupply: number;
  currentHour: number;
  attractionFactor?: number;
}

export function ParkingSupplyDemand({
  scenario,
  totalSupply,
  competitorSupply,
  currentHour,
  attractionFactor = 0.02,
}: ParkingSupplyDemandProps) {
  const diamanteSpaces = totalSupply - competitorSupply;

  const data = Array.from({ length: 24 }, (_, hour) => {
    const { demand } = getParkingDemand(scenario, hour, totalSupply, 0, attractionFactor);
    return {
      hour: hourLabel(hour),
      hourNum: hour,
      demand,
      ofertaTotal: totalSupply,
      ofertaDiamante: diamanteSpaces,
    };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9, fill: "#ffffff60" }}
            interval={3}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#ffffff60" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#fff" }}
            formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name ?? "")]}
          />
          <ReferenceLine
            y={totalSupply}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: `Oferta total (${formatNumber(totalSupply)})`, fill: "#22c55e", fontSize: 9 }}
          />
          <ReferenceLine
            y={diamanteSpaces}
            stroke="#3b82f6"
            strokeDasharray="6 3"
            label={{ value: `Solo Diamante (${formatNumber(diamanteSpaces)})`, fill: "#3b82f6", fontSize: 9 }}
          />
          <Bar dataKey="demand" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Demanda estimada" />
          <ReferenceLine x={hourLabel(currentHour)} stroke="#ffffff40" strokeDasharray="3 3" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-white/30 mt-1">
        Demanda = tráfico polígono × {(attractionFactor * 100).toFixed(0)}% atracción · Oferta = competencia ({formatNumber(competitorSupply)}) + Diamante ({formatNumber(diamanteSpaces)})
      </p>
    </div>
  );
}
