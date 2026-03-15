"use client";

import type { TabId, Scenario } from "@/types";
import { TabBar } from "@/components/ui/TabBar";
import { ExecutiveTab } from "./ExecutiveTab";
import { TrafficTab } from "./TrafficTab";
import { ParkingTab } from "./ParkingTab";
import { CommerceTab } from "./CommerceTab";
import { PersonasTab } from "./PersonasTab";
import { EventsTab } from "./EventsTab";
import { UrbanTab } from "./UrbanTab";
import { FinancialTab } from "./FinancialTab";
import { EstructuradorTab } from "./EstructuradorTab";

interface PanelContainerProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  scenario: Scenario;
  hour: number;
}

export function PanelContainer({ activeTab, onTabChange, scenario, hour }: PanelContainerProps) {
  return (
    <div className="flex h-full flex-col bg-gray-950 border-r border-white/10">
      <div className="pt-2">
        <TabBar activeTab={activeTab} onTabChange={onTabChange} />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === "ejecutivo" && <ExecutiveTab scenario={scenario} hour={hour} />}
        {activeTab === "trafico" && <TrafficTab scenario={scenario} hour={hour} />}
        {activeTab === "parking" && <ParkingTab scenario={scenario} hour={hour} />}
        {activeTab === "comercio" && <CommerceTab />}
        {activeTab === "personas" && <PersonasTab scenario={scenario} hour={hour} />}
        {activeTab === "eventos" && <EventsTab scenario={scenario} />}
        {activeTab === "urbanismo" && <UrbanTab />}
        {activeTab === "financiero" && <FinancialTab />}
        {activeTab === "estructurador" && <EstructuradorTab scenario={scenario} hour={hour} />}
      </div>
    </div>
  );
}
