"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HotelOccupancy } from "@/types";

interface HotelOccupancyChartProps {
  data: HotelOccupancy[];
}

export function HotelOccupancyChart({ data }: HotelOccupancyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
          formatter={(value) => `${value}%`}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="baseOccupancy" stackId="a" fill="#3b82f6" name="Base" radius={[0, 0, 0, 0]} />
        <Bar dataKey="eventUplift" stackId="a" fill="#f59e0b" name="Eventos" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
