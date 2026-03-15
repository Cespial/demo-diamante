"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Scenario, TrafficAforo } from "@/types";
import { applyScenarioToTraffic } from "@/lib/scenario-engine";
import { hourLabel, formatNumber } from "@/lib/utils";

interface TrafficHourlyChartProps {
  aforos: TrafficAforo[];
  scenario: Scenario;
  currentHour: number;
}

export function TrafficHourlyChart({ aforos, scenario, currentHour }: TrafficHourlyChartProps) {
  const data = Array.from({ length: 24 }, (_, hour) => {
    const totalByType = aforos.reduce(
      (acc, a) => {
        const base = a.hourly.find((h) => h.hour === hour) ?? a.hourly[0];
        const adj = applyScenarioToTraffic(base, scenario, hour);
        acc.autos += adj.autos;
        acc.motos += adj.motos;
        acc.buses += adj.buses;
        acc.total += adj.total;
        acc.speed += adj.avgSpeed;
        acc.count++;
        return acc;
      },
      { autos: 0, motos: 0, buses: 0, total: 0, speed: 0, count: 0 }
    );
    return {
      hour: hourLabel(hour),
      hourNum: hour,
      autos: totalByType.autos,
      motos: totalByType.motos,
      buses: totalByType.buses,
      total: totalByType.total,
      avgSpeed: totalByType.count > 0 ? Math.round(totalByType.speed / totalByType.count) : 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAutos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorMotos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => formatNumber(v)}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "#fff" }}
        />
        <Area type="monotone" dataKey="autos" stroke="#3b82f6" fill="url(#colorAutos)" strokeWidth={1.5} name="Autos" />
        <Area type="monotone" dataKey="motos" stroke="#22c55e" fill="url(#colorMotos)" strokeWidth={1.5} name="Motos" />
        <Area type="monotone" dataKey="buses" stroke="#f59e0b" fill="none" strokeWidth={1} name="Buses" />
        <ReferenceLine x={hourLabel(currentHour)} stroke="#ffffff40" strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
