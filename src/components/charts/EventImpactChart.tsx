"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SCENARIOS, SCENARIO_IDS } from "@/data/scenarios";

export function EventImpactChart() {
  const data = SCENARIO_IDS
    .filter((id) => id !== "normal")
    .map((id) => {
      const s = SCENARIOS[id];
      return {
        name: s.label,
        asistencia: s.attendance,
        multiplicador: s.vehicleMultiplier,
        parking: s.parkingDemand,
        fill: s.color,
      };
    });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#ffffff80" }} width={70} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
          formatter={(value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        />
        <Bar dataKey="asistencia" name="Asistencia" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <rect key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
