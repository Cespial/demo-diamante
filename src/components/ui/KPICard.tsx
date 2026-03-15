"use client";

import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string;
}

export function KPICard({
  label,
  value,
  subtitle,
  trend,
  trendValue,
  color = "#3b82f6",
}: KPICardProps) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:scale-[1.02] hover:bg-white/[0.07] hover:border-white/15 cursor-default"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="mb-1 text-xs font-medium text-white/50">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-white/40">{subtitle}</div>
      )}
      {trend && trendValue && (
        <div
          className={cn(
            "mt-1 text-xs font-medium",
            trend === "up" && "text-green-400",
            trend === "down" && "text-red-400",
            trend === "neutral" && "text-white/40"
          )}
        >
          {trend === "up" ? "+" : trend === "down" ? "-" : ""}
          {trendValue}
        </div>
      )}
    </div>
  );
}
