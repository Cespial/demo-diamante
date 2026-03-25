"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayerGroup {
  name: string;
  layers: { id: string; label: string }[];
}

const LAYER_GROUPS: LayerGroup[] = [
  {
    name: "Tráfico",
    layers: [
      { id: "traffic-live", label: "Tráfico en vivo (Google)" },
      { id: "traffic-corridors", label: "Corredores (vel. SIMM)" },
      { id: "traffic-od", label: "Orígenes → Diamante" },
      { id: "traffic-closures", label: "Simulación cierres viales" },
      { id: "traffic-incidents", label: "Incidentes viales (6,384)" },
      { id: "isochrone-driving", label: "Isócrona vehículo" },
      { id: "isochrone-walking", label: "Isócrona peatonal" },
    ],
  },
  {
    name: "Parqueaderos",
    layers: [
      { id: "parking-existing", label: "Parqueaderos (822 celdas)" },
      { id: "parking-spaces", label: "Celdas individuales (6,927)" },
    ],
  },
  {
    name: "Comercio y POIs",
    layers: [
      { id: "commerce-restaurants", label: "Restaurantes / Bares" },
      { id: "commerce-hotels", label: "Hoteles" },
      { id: "commerce-shops", label: "Comercio general" },
      { id: "commerce-sports", label: "Deportes / Ocio" },
      { id: "commerce-attractions", label: "Atracciones turísticas" },
    ],
  },
  {
    name: "Eventos",
    layers: [
      { id: "events-radius", label: "Distancia caminando (3/5/8 min)" },
    ],
  },
  {
    name: "Urbanismo",
    layers: [
      { id: "urban-diamante", label: "Predio Diamante" },
      { id: "urban-stadium", label: "Complejo Deportivo" },
      { id: "urban-comuna", label: "Límite Comuna 11" },
      { id: "urban-barrios", label: "Manzanas (oferta/demanda)" },
      { id: "urban-roads", label: "Malla vial POT (703 seg.)" },
      { id: "urban-study-polygon", label: "Polígono de estudio" },
      { id: "urban-licenses", label: "Licencias" },
    ],
  },
];

interface LayerControlProps {
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function LayerControl({ visibility, onToggle }: LayerControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-gray-900/90 backdrop-blur-sm border border-white/10 shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/80 hover:text-white w-full"
      >
        <Layers size={16} />
        Capas
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          {LAYER_GROUPS.map((group) => (
            <div key={group.name} className="mb-2">
              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                {group.name}
              </div>
              {group.layers.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-white/60 hover:text-white/80"
                >
                  <input
                    type="checkbox"
                    checked={visibility[layer.id] ?? false}
                    onChange={() => onToggle(layer.id)}
                    className="h-3 w-3 rounded border-white/30 accent-blue-500"
                  />
                  {layer.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
