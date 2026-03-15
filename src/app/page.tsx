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
      <header className="header-glass flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Diamond size={22} className="text-blue-400" />
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 pulse-live" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-tight">
              <span className="text-white">Demo Diamante</span>
            </span>
            <span className="text-[10px] text-white/30 tracking-widest uppercase">
              Preparado para <span className="text-blue-400/70 font-medium">Estima</span> por tensor.lat
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1">
            <ScenarioSelector active={state.activeScenario} onChange={setScenario} />
          </div>
          <div className="h-5 w-px bg-white/[0.08]" />
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
            <TimeSlider hour={state.hour} onChange={setHour} />
          </div>
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
