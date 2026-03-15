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
import { hourLabel } from "@/lib/utils";

interface ParkingSupplyDemandProps {
  scenario: Scenario;
  totalSpaces: number;
  currentHour: number;
}

export function ParkingSupplyDemand({ scenario, totalSpaces, currentHour }: ParkingSupplyDemandProps) {
  const data = Array.from({ length: 24 }, (_, hour) => {
    const { demand, occupancy } = getParkingDemand(scenario, hour, totalSpaces);
    return {
      hour: hourLabel(hour),
      hourNum: hour,
      demand,
      supply: totalSpaces,
      occupancy: Math.round(occupancy * 100),
    };
  });

  return (
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
        />
        <ReferenceLine y={totalSpaces} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Capacidad", fill: "#ef4444", fontSize: 10 }} />
        <Bar dataKey="demand" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Demanda" />
        <ReferenceLine x={hourLabel(currentHour)} stroke="#ffffff40" strokeDasharray="3 3" />
      </BarChart>
    </ResponsiveContainer>
  );
}
