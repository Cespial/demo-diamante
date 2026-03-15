"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ScenarioId, TabId, AppState } from "@/types";
import { SCENARIOS } from "@/data/scenarios";
import { getScenario } from "./scenario-engine";

// ── useAppState ──
export function useAppState() {
  const [state, setState] = useState<AppState>({
    activeScenario: "normal",
    activeTab: "ejecutivo",
    hour: 12,
    layerVisibility: {
      "traffic-live": false,
      "traffic-corridors": true,
      "traffic-od": false,
      "traffic-closures": false,
      "traffic-incidents": false,
      "isochrone-driving": true,
      "isochrone-walking": false,
      "parking-existing": true,
      "commerce-restaurants": false,
      "commerce-hotels": false,
      "commerce-shops": false,
      "commerce-sports": false,
      "personas-heatmap": true,
      "events-radius": false,
      "events-heatmap": false,
      "urban-diamante": true,
      "urban-stadium": true,
      "urban-comuna": true,
      "urban-barrios": false,
      "urban-roads": false,
      "urban-licenses": false,
    },
  });

  const setScenario = useCallback((id: ScenarioId) => {
    setState((s) => ({ ...s, activeScenario: id }));
  }, []);

  const setTab = useCallback((id: TabId) => {
    setState((s) => ({ ...s, activeTab: id }));
  }, []);

  const setHour = useCallback((hour: number) => {
    setState((s) => ({ ...s, hour }));
  }, []);

  const toggleLayer = useCallback((layerId: string) => {
    setState((s) => ({
      ...s,
      layerVisibility: {
        ...s.layerVisibility,
        [layerId]: !s.layerVisibility[layerId],
      },
    }));
  }, []);

  const scenario = useMemo(
    () => getScenario(state.activeScenario),
    [state.activeScenario]
  );

  return {
    state,
    scenario,
    setScenario,
    setTab,
    setHour,
    toggleLayer,
  };
}

// ── useData: fetch JSON from public/data/ ──
export function useData<T>(path: string): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}
