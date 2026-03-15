"use client";

import { hourLabel } from "@/lib/utils";

interface TimeSliderProps {
  hour: number;
  onChange: (hour: number) => void;
}

export function TimeSlider({ hour, onChange }: TimeSliderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400/60 pulse-live" />
        <span className="text-[10px] uppercase tracking-wider text-white/30">Hora</span>
      </div>
      <input
        type="range"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-28 cursor-pointer"
      />
      <span className="text-xs font-mono font-semibold text-blue-400 w-14 text-right tabular-nums">
        {hourLabel(hour)}
      </span>
    </div>
  );
}
