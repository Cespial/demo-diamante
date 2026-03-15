"use client";

import { useState } from "react";
import type { FinancialParams } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { RevenueProjection } from "@/components/charts/RevenueProjection";
import { calculateFinancials } from "@/lib/financial-model";
import { DEFAULT_FINANCIAL_PARAMS } from "@/data/financial-params";
import { formatCOP, formatCOPFull } from "@/lib/utils";

export function FinancialTab() {
  const [params, setParams] = useState<FinancialParams>(DEFAULT_FINANCIAL_PARAMS);
  const result = calculateFinancials(params);

  const update = (key: keyof FinancialParams, value: number) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Modelo Financiero</h2>
      <p className="text-xs text-white/40">Ajuste parámetros para modelar ingresos</p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Ingreso Bruto" value={formatCOP(result.totalGross)} subtitle="/año" color="#3b82f6" />
        <KPICard label="Ingreso Neto" value={formatCOP(result.netIncome)} subtitle="/año" color="#22c55e" />
        <KPICard label="Costos Op." value={formatCOP(result.operatingCosts)} subtitle={`${Math.round(params.operatingCostPct * 100)}%`} color="#ef4444" />
        <KPICard label="Parking Rev." value={formatCOP(result.parkingBase + result.parkingSurcharge)} subtitle="Base + Eventos" color="#f59e0b" />
      </div>

      <Card>
        <CardHeader>Proyección Mensual</CardHeader>
        <CardContent>
          <RevenueProjection params={params} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Parámetros Ajustables</CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            <SliderParam
              label="Celdas de Parqueadero"
              value={params.parkingSpaces}
              min={200}
              max={1500}
              step={50}
              format={(v) => `${v} celdas`}
              onChange={(v) => update("parkingSpaces", v)}
            />
            <SliderParam
              label="Tarifa Base"
              value={params.baseTariff}
              min={3000}
              max={10000}
              step={500}
              format={(v) => formatCOPFull(v) + "/hr"}
              onChange={(v) => update("baseTariff", v)}
            />
            <SliderParam
              label="Ocupación Comercio"
              value={params.commerceOccupancy * 100}
              min={50}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => update("commerceOccupancy", v / 100)}
            />
            <SliderParam
              label="Costos Operativos"
              value={params.operatingCostPct * 100}
              min={20}
              max={50}
              step={5}
              format={(v) => `${v}%`}
              onChange={(v) => update("operatingCostPct", v / 100)}
            />
            <SliderParam
              label="Eventos/Año"
              value={params.eventsPerYear}
              min={20}
              max={100}
              step={5}
              format={(v) => `${v} eventos`}
              onChange={(v) => update("eventsPerYear", v)}
            />
            <SliderParam
              label="Pases Mensuales"
              value={params.monthlyPassSlots}
              min={10}
              max={100}
              step={5}
              format={(v) => `${v} slots`}
              onChange={(v) => update("monthlyPassSlots", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Desglose Anual</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs text-white/60">
            <Row label="Parking base" value={result.parkingBase} />
            <Row label="Surcharge eventos" value={result.parkingSurcharge} />
            <Row label="Pases mensuales" value={result.monthlyPasses} />
            <Row label="Valet" value={result.valetRevenue} />
            <Row label="Comercio renta" value={result.commerceRent} />
            <div className="border-t border-white/10 pt-1 flex justify-between font-semibold text-white">
              <span>Total Bruto</span>
              <span>{formatCOPFull(result.totalGross)}</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>Costos Operativos</span>
              <span>-{formatCOPFull(result.operatingCosts)}</span>
            </div>
            <div className="flex justify-between font-bold text-green-400 text-sm pt-1">
              <span>INGRESO NETO</span>
              <span>{formatCOPFull(result.netIncome)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-white/80">{formatCOPFull(value)}</span>
    </div>
  );
}

function SliderParam({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-white/60 mb-1">
        <span>{label}</span>
        <span className="text-white/80 font-medium">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-500"
      />
    </div>
  );
}
