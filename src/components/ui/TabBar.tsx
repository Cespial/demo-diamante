"use client";

import { cn } from "@/lib/utils";
import type { TabId } from "@/types";
import {
  BarChart3,
  Car,
  ParkingSquare,
  Store,
  Users,
  Calendar,
  Building2,
  DollarSign,
  FileText,
} from "lucide-react";

const TAB_CONFIG: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "ejecutivo", label: "Ejecutivo", icon: <BarChart3 size={16} /> },
  { id: "trafico", label: "Tráfico", icon: <Car size={16} /> },
  { id: "parking", label: "Parking", icon: <ParkingSquare size={16} /> },
  { id: "comercio", label: "Comercio", icon: <Store size={16} /> },
  { id: "personas", label: "Personas", icon: <Users size={16} /> },
  { id: "eventos", label: "Eventos", icon: <Calendar size={16} /> },
  { id: "urbanismo", label: "POT", icon: <Building2 size={16} /> },
  { id: "financiero", label: "Financiero", icon: <DollarSign size={16} /> },
  { id: "estructurador", label: "Estructurador", icon: <FileText size={16} /> },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 pb-2">
      {TAB_CONFIG.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeTab === tab.id
              ? "bg-white/15 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white/70"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
