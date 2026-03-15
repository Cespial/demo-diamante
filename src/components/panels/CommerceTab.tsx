"use client";

import type { CommercePOI } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { KPICard } from "@/components/ui/KPICard";
import { CommerceBreakdown } from "@/components/charts/CommerceBreakdown";
import { useData } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { Star } from "lucide-react";

export function CommerceTab() {
  const { data: commerce, loading: loadC } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: hotels, loading: loadH } = useData<CommercePOI[]>("/data/hotels-pois.json");
  const { data: sports, loading: loadS } = useData<CommercePOI[]>("/data/sports-venues.json");

  if (loadC || loadH || loadS || !commerce) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const restaurants = commerce.filter((c) => ["restaurant", "cafe", "bar", "fast_food"].includes(c.category));
  const shops = commerce.filter((c) => ["shop", "bank", "pharmacy", "supermarket", "bakery"].includes(c.category));
  const spas = commerce.filter((c) => ["spa", "beauty_salon"].includes(c.subcategory || c.category));

  // Compute avg rating for restaurants with ratings
  const ratedRestaurants = restaurants.filter((r) => r.rating && r.rating > 0);
  const avgRating = ratedRestaurants.length > 0
    ? (ratedRestaurants.reduce((s, r) => s + (r.rating ?? 0), 0) / ratedRestaurants.length).toFixed(1)
    : "N/A";

  // Top rated restaurants
  const topRated = [...restaurants]
    .filter((r) => r.rating && r.reviewCount && r.reviewCount > 5)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Mapeo Comercial</h2>
      <p className="text-xs text-white/40">
        Datos reales Google Places — Radio 1km
      </p>

      <div className="grid grid-cols-2 gap-2">
        <KPICard label="Total Comercios" value={String(commerce.length)} color="#3b82f6" />
        <KPICard label="Restaurantes/Bares" value={String(restaurants.length)} subtitle={`Rating prom: ${avgRating}`} color="#f97316" />
        <KPICard label="Hoteles" value={String(hotels?.length ?? 0)} color="#a855f7" />
        <KPICard label="Deportes/Ocio" value={String(sports?.length ?? 0)} color="#22c55e" />
      </div>

      <Card>
        <CardHeader>Distribución por Categoría</CardHeader>
        <CardContent>
          <CommerceBreakdown commerce={commerce} />
        </CardContent>
      </Card>

      {topRated.length > 0 && (
        <Card>
          <CardHeader>Top Restaurantes / Bares (por Rating)</CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
              {topRated.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-white/60">
                  <span className="truncate mr-2 flex-1">{r.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.rating && (
                      <span className="flex items-center gap-0.5 text-yellow-400">
                        <Star size={10} fill="currentColor" />
                        {r.rating}
                      </span>
                    )}
                    {r.reviewCount && (
                      <span className="text-white/30">({r.reviewCount})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Hoteles y Alojamiento ({hotels?.length ?? 0})</CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
            {(hotels ?? [])
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 15)
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between text-white/60">
                  <span className="truncate mr-2 flex-1">{h.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {h.rating && (
                      <span className="flex items-center gap-0.5 text-yellow-400">
                        <Star size={10} fill="currentColor" />
                        {h.rating}
                      </span>
                    )}
                    {h.reviewCount && (
                      <span className="text-white/30">({h.reviewCount})</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
          <p className="text-[10px] text-white/30 mt-2">
            Zona hotelería Cra 76-80: turismo médico, wellness, negocios
          </p>
        </CardContent>
      </Card>

      {spas.length > 0 && (
        <Card>
          <CardHeader>Turismo Médico / Wellness ({spas.length})</CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs text-white/60 max-h-24 overflow-y-auto">
              {spas.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="truncate mr-2">{s.name}</span>
                  {s.rating && <span className="text-yellow-400">{s.rating}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>Oportunidad Comercial</CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-white/60 list-disc list-inside">
            <li>~2,000 m2 de comercio a nivel en el Diamante</li>
            <li>Renta estimada: $60K-$120K COP/m2/mes</li>
            <li>Alta densidad gastronómica ({restaurants.length} restaurantes) favorece food court</li>
            <li>Proximidad a {sports?.length ?? 0} venues deportivos genera tráfico cautivo</li>
            <li>{hotels?.length ?? 0} hoteles en zona genera demanda adicional de parqueadero</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
