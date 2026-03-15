"use client";

import { MAP_STYLES, MAP_STYLE_LABELS } from "@/data/diamante-config";
import type { MapStyleId } from "@/data/diamante-config";
import { Map as MapIcon } from "lucide-react";

interface MapStyleSelectorProps {
  active: MapStyleId;
  onChange: (style: MapStyleId) => void;
}

const STYLE_IDS = Object.keys(MAP_STYLES) as MapStyleId[];

export function MapStyleSelector({ active, onChange }: MapStyleSelectorProps) {
  return (
    <div className="rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-black/10 dark:border-white/10 shadow-lg p-1.5 flex gap-1">
      {STYLE_IDS.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
            active === id
              ? "bg-blue-500 text-white shadow-sm"
              : "text-gray-600 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {MAP_STYLE_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
