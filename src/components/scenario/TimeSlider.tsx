"use client";

import { hourLabel } from "@/lib/utils";

interface TimeSliderProps {
  hour: number;
  onChange: (hour: number) => void;
}

export function TimeSlider({ hour, onChange }: TimeSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 w-14 text-right">{hourLabel(hour)}</span>
      <input
        type="range"
        min={0}
        max={23}
        value={hour}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-white/20 accent-blue-500"
      />
    </div>
  );
}
