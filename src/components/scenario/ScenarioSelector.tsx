"use client";

import { cn } from "@/lib/utils";
import type { ScenarioId } from "@/types";
import { SCENARIOS, SCENARIO_IDS } from "@/data/scenarios";
import {
  Sun,
  Trophy,
  Flame,
  Music,
  Moon,
  Flower2,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  Sun: <Sun size={14} />,
  Trophy: <Trophy size={14} />,
  Flame: <Flame size={14} />,
  Music: <Music size={14} />,
  Moon: <Moon size={14} />,
  Flower2: <Flower2 size={14} />,
};

interface ScenarioSelectorProps {
  active: ScenarioId;
  onChange: (id: ScenarioId) => void;
}

export function ScenarioSelector({ active, onChange }: ScenarioSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {SCENARIO_IDS.map((id) => {
        const s = SCENARIOS[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={s.description}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
              isActive
                ? "text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            )}
            style={
              isActive
                ? { backgroundColor: s.color + "33", borderColor: s.color, border: `1px solid ${s.color}` }
                : undefined
            }
          >
            {ICON_MAP[s.icon]}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
