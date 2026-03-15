"use client";

import { useAppState } from "@/lib/hooks";
import { ScenarioSelector } from "@/components/scenario/ScenarioSelector";
import { TimeSlider } from "@/components/scenario/TimeSlider";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { DiamanteMap } from "@/components/map/DiamanteMap";
import { Diamond } from "lucide-react";

export default function Home() {
  const { state, scenario, setScenario, setTab, setHour, toggleLayer } =
    useAppState();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <Diamond size={20} className="text-blue-400" />
          <span className="text-sm font-bold tracking-tight">
            <span className="text-white/50">tensor.lat</span>{" "}
            <span className="text-white">Demo Diamante</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <ScenarioSelector active={state.activeScenario} onChange={setScenario} />
          <div className="h-4 w-px bg-white/10" />
          <TimeSlider hour={state.hour} onChange={setHour} />
        </div>
      </header>

      {/* Main: Sidebar + Map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[380px] flex-shrink-0 overflow-hidden">
          <PanelContainer
            activeTab={state.activeTab}
            onTabChange={setTab}
            scenario={scenario}
            hour={state.hour}
          />
        </aside>

        {/* Map */}
        <main className="flex-1">
          <DiamanteMap
            scenario={scenario}
            hour={state.hour}
            layerVisibility={state.layerVisibility}
            onToggleLayer={toggleLayer}
          />
        </main>
      </div>
    </div>
  );
}
