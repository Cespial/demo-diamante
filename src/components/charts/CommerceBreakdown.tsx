"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { CommercePOI } from "@/types";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#64748b"];

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurantes",
  cafe: "Cafés",
  bar: "Bares",
  fast_food: "Comida rápida",
  shop: "Tiendas",
  bank: "Bancos",
  pharmacy: "Farmacias",
  clinic: "Clínicas",
  sports: "Deportes",
  fitness: "Gimnasios",
  hotel: "Hoteles",
  hostel: "Hostales",
  stadium: "Estadios",
};

interface CommerceBreakdownProps {
  commerce: CommercePOI[];
}

export function CommerceBreakdown({ commerce }: CommerceBreakdownProps) {
  const counts: Record<string, number> = {};
  commerce.forEach((c) => {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
  });

  const data = Object.entries(counts)
    .map(([key, value]) => ({
      name: CATEGORY_LABELS[key] ?? key,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          dataKey="value"
          strokeWidth={1}
          stroke="#0a0a0a"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value) => <span className="text-white/60">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
