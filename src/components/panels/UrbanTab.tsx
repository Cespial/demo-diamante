"use client";

import type { UrbanLicense, POTConstraint } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { useData } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";

export function UrbanTab() {
  const { data: licenses, loading: loadL } = useData<UrbanLicense[]>("/data/urban-licenses.json");
  const { data: pot, loading: loadP } = useData<POTConstraint[]>("/data/pot-constraints.json");

  if (loadL || loadP) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const totalLicenses = licenses?.length ?? 0;
  const typeCounts: Record<string, number> = {};
  licenses?.forEach((l) => {
    typeCounts[l.tipo] = (typeCounts[l.tipo] ?? 0) + 1;
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">POT y Normativa</h2>
      <p className="text-xs text-white/40">Comuna 11 — Laureles-Estadio</p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Licencias Recientes" value={String(totalLicenses)} color="#3b82f6" />
        <KPICard label="Restricciones POT" value={String(pot?.length ?? 0)} color="#f59e0b" />
      </div>

      {pot && pot.length > 0 && (
        <Card>
          <CardHeader>Restricciones del POT</CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              {pot.map((p) => (
                <div key={p.id} className="border-b border-white/5 pb-2">
                  <div className="flex justify-between text-white/80">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-blue-400">{p.value}</span>
                  </div>
                  <div className="text-white/40 mt-0.5">{p.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Licencias por Tipo</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60">
            {Object.entries(typeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([tipo, count]) => (
                <div key={tipo} className="flex justify-between">
                  <span>{tipo}</span>
                  <span className="text-white/80">{count}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Licencias Recientes</CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-white/60 max-h-48 overflow-y-auto">
            {licenses?.slice(0, 20).map((l) => (
              <div key={l.id} className="flex justify-between">
                <span className="truncate mr-2">{l.tipo} — {l.area} m²</span>
                <span className="text-white/40">{l.fecha}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Contexto Urbanístico</CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-white/60 list-disc list-inside">
            <li>Zona de uso mixto: residencial + comercial + deportivo</li>
            <li>Tratamiento: Consolidación Nivel 3 (CN3)</li>
            <li>Altura máx: 5-8 pisos (dependiendo del predio)</li>
            <li>2 sótanos de parqueadero compatibles con norma</li>
            <li>Parqueadero público no computa como área construida</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
