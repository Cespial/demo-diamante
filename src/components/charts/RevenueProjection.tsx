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
import type { FinancialParams } from "@/types";
import { calculateMonthlyProjection } from "@/lib/financial-model";
import { formatCOP } from "@/lib/utils";

interface RevenueProjectionProps {
  params: FinancialParams;
}

export function RevenueProjection({ params }: RevenueProjectionProps) {
  const data = calculateMonthlyProjection(params);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#ffffff60" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 9, fill: "#ffffff60" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCOP(v)}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #ffffff20", borderRadius: 8, fontSize: 11 }}
          formatter={(value) => formatCOP(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="gross" fill="#3b82f6" name="Bruto" radius={[2, 2, 0, 0]} />
        <Bar dataKey="net" fill="#22c55e" name="Neto" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
