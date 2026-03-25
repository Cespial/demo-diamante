"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Scenario, TrafficCorridor, ParkingPOI, CommercePOI, TrafficIncident, ODRoute } from "@/types";
import { DIAMANTE_CENTER, MAP_DEFAULT_ZOOM, IMPACT_RADII, DIAMANTE_POLYGON, STUDY_POLYGON } from "@/data/diamante-config";
import { applyScenarioToTraffic } from "@/lib/scenario-engine";
import { speedToColor } from "@/lib/mapbox-utils";
import { useData } from "@/lib/hooks";
import { LayerControl } from "./LayerControl";
import { MapLegend } from "./MapLegend";

// API key loaded from environment variable NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
// Configure in Vercel Dashboard → Settings → Environment Variables
// Or in .env.local for local development
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

interface DiamanteMapProps {
  scenario: Scenario;
  hour: number;
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
  selectedRoadIds?: string[];
  onToggleRoad?: (roadId: string) => void;
  onClearSelection?: () => void;
}

// Load Google Maps script with Drawing + Geometry libraries
function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps) { setLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener("load", () => setLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&v=weekly&libraries=drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

export function DiamanteMap({ scenario, hour, layerVisibility, onToggleLayer, selectedRoadIds = [], onToggleRoad, onClearSelection }: DiamanteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<(google.maps.Polyline | google.maps.Polygon | google.maps.Circle | google.maps.Marker | google.maps.InfoWindow)[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const googleLoaded = useGoogleMaps();

  // Data
  const { data: corridors } = useData<TrafficCorridor[]>("/data/traffic-corridors.json");
  const { data: parking } = useData<ParkingPOI[]>("/data/parking-pois.json");
  const { data: commerce } = useData<CommercePOI[]>("/data/commerce-pois.json");
  const { data: hotels } = useData<CommercePOI[]>("/data/hotels-pois.json");
  const { data: sports } = useData<CommercePOI[]>("/data/sports-venues.json");
  const { data: incidents } = useData<TrafficIncident[]>("/data/incidents-laureles.json");
  const { data: odRoutes } = useData<ODRoute[]>("/data/od-routes.json");
  const { data: isochrones } = useData<{ driving: GeoJSON.FeatureCollection; walking: GeoJSON.FeatureCollection }>("/data/isochrones.json");
  const { data: comuna11 } = useData<GeoJSON.FeatureCollection>("/data/comuna11-boundary.json");
  const { data: stadium } = useData<GeoJSON.FeatureCollection>("/data/stadium-footprint.json");
  const { data: closureRoutes } = useData<any[]>("/data/closure-routes.json");
  const { data: attractions } = useData<CommercePOI[]>("/data/attractions-pois.json");
  const { data: studyRoads } = useData<GeoJSON.FeatureCollection>("/data/study-road-network.geojson");
  const { data: parkingPolygons } = useData<GeoJSON.FeatureCollection>("/data/parking-polygons.geojson");
  const { data: manzanas } = useData<GeoJSON.FeatureCollection>("/data/manzanas-grid.geojson");
  const { data: speedProfiles } = useData<{ corredor: string; sentido: string; hora: number; velocidad_promedio_kmh: number; intensidad_promedio: number }[]>("/data/traffic-speeds-official.json");

  // Load parking spaces based on scenario
  const spacesFile = scenario.id === "clasico" || scenario.id === "concierto"
    ? "/data/parking-spaces-clasico.geojson"
    : "/data/parking-spaces-normal.geojson";
  const { data: parkingSpaces } = useData<GeoJSON.FeatureCollection>(spacesFile);

  const vis = useCallback((id: string) => layerVisibility[id] ?? false, [layerVisibility]);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!googleLoaded || !mapContainerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: { lat: DIAMANTE_CENTER.lat, lng: DIAMANTE_CENTER.lng },
      zoom: MAP_DEFAULT_ZOOM,
      mapTypeId: "hybrid",
      mapTypeControl: true,
      mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [googleLoaded]);

  // Draw overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleLoaded) return;

    // Clear previous overlays
    overlaysRef.current.forEach((o) => {
      if ("setMap" in o) (o as any).setMap(null);
    });
    overlaysRef.current = [];

    const add = (o: any) => { overlaysRef.current.push(o); };
    const iw = infoWindowRef.current!;

    // ── Google Traffic Layer (real-time) ──
    if (vis("traffic-live")) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
    } else {
      trafficLayerRef.current?.setMap(null);
    }

    // ── Manzana grid (block-by-block demand/supply) ──
    if (vis("urban-barrios") && manzanas) {
      manzanas.features.forEach((f: any) => {
        const p = f.properties;
        const ratio = p.demand_ratio || 0;
        // Color by demand/supply ratio: green (<0.5), yellow (0.5-1), orange (1-1.5), red (>1.5)
        const color = ratio > 1.5 ? "#ef4444" : ratio > 1.0 ? "#f97316" : ratio > 0.5 ? "#eab308" : "#22c55e";
        const opacity = Math.min(0.4, 0.1 + ratio * 0.15);

        const poly = new google.maps.Polygon({
          paths: f.geometry.coordinates[0].map(([lng, lat]: number[]) => ({ lat, lng })),
          fillColor: color,
          fillOpacity: opacity,
          strokeColor: "#ffffff15",
          strokeWeight: 0.5,
          map,
        });
        poly.addListener("click", () => {
          iw.setContent(
            `<div style="max-width:220px">` +
            `<b>Manzana ${p.block_id}</b><br>` +
            `<b style="color:${color}">Ratio demanda/oferta: ${ratio}</b><br>` +
            `Celdas formales: ${p.formal_spaces}<br>` +
            `Est. parqueo calle: ${p.est_street_spaces}<br>` +
            `Total oferta: ${p.total_spaces}<br>` +
            `Tráfico pico cercano: ${p.peak_traffic_nearby} veh/hr<br>` +
            (p.nearest_aforo ? `Aforo: ${p.nearest_aforo}<br>` : "") +
            (p.parking_names?.length ? `Parqueaderos: ${p.parking_names.join(", ")}<br>` : "") +
            `<span style="color:#999;font-size:10px">Fuente: grid sintético + OSM + SIMM</span>` +
            `</div>`
          );
          const bounds = new google.maps.LatLngBounds();
          f.geometry.coordinates[0].forEach(([lng, lat]: number[]) => bounds.extend({ lat, lng }));
          iw.setPosition(bounds.getCenter());
          iw.open(map);
        });
        add(poly);
      });
    }

    // ── Study polygon (Cra 68–77C × Cll 45–53A) — toggleable ──
    if (vis("urban-study-polygon")) {
    const studyPoly = new google.maps.Polygon({
      paths: STUDY_POLYGON.map(([lng, lat]) => ({ lat, lng })),
      fillColor: "#f59e0b",
      fillOpacity: 0.05,
      strokeColor: "#f59e0b",
      strokeWeight: 2,
      strokeOpacity: 0.7,
      map,
    });
    // Dashed effect via icons
    const studyOutline = new google.maps.Polyline({
      path: STUDY_POLYGON.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: "#f59e0b",
      strokeWeight: 2,
      strokeOpacity: 0,
      map,
      icons: [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, strokeColor: "#f59e0b", scale: 2 },
        offset: "0",
        repeat: "12px",
      }],
    });
    add(studyPoly);
    add(studyOutline);
    } // end urban-study-polygon

    // ── Diamante de Béisbol — PROYECTO (emerald green, pulsing) ──
    // Animated pulse ring
    const pulseCircle = new google.maps.Circle({
      center: { lat: DIAMANTE_CENTER.lat, lng: DIAMANTE_CENTER.lng },
      radius: 80,
      fillColor: "#10b981",
      fillOpacity: 0.08,
      strokeColor: "#34d399",
      strokeWeight: 1.5,
      strokeOpacity: 0.4,
      map,
      zIndex: 90,
    });
    add(pulseCircle);

    // Diamante polygon (footprint) — emerald green
    const diamante = new google.maps.Polygon({
      paths: DIAMANTE_POLYGON.map(([lng, lat]) => ({ lat, lng })),
      fillColor: "#059669",
      fillOpacity: 0.55,
      strokeColor: "#34d399",
      strokeWeight: 3,
      map,
      zIndex: 95,
    });
    diamante.addListener("click", () => {
      iw.setContent(
        `<div style="max-width:280px;font-family:system-ui">` +
        `<div style="background:linear-gradient(135deg,#059669,#10b981);padding:10px 14px;border-radius:8px 8px 0 0;margin:-8px -12px 8px -12px">` +
        `<b style="font-size:15px;color:#fff">◆ Diamante de Béisbol</b><br>` +
        `<span style="color:#d1fae5;font-size:11px">Proyecto de estacionamiento subterráneo</span>` +
        `</div>` +
        `<table style="width:100%;font-size:11px;border-collapse:collapse">` +
        `<tr><td style="color:#888;padding:3px 0">Celdas</td><td style="text-align:right;font-weight:600">1,100</td></tr>` +
        `<tr><td style="color:#888;padding:3px 0">Niveles</td><td style="text-align:right">2 sótanos</td></tr>` +
        `<tr><td style="color:#888;padding:3px 0">Comercio</td><td style="text-align:right">~2,000 m²</td></tr>` +
        `<tr><td style="color:#888;padding:3px 0">CAPEX est.</td><td style="text-align:right">$98,175M COP</td></tr>` +
        `<tr><td style="color:#888;padding:3px 0">Payback</td><td style="text-align:right">~9.6 años</td></tr>` +
        `<tr style="border-top:1px solid #eee"><td style="color:#888;padding:5px 0 2px">Ubicación</td><td style="text-align:right;font-size:10px">Cra 70 × Cll 48</td></tr>` +
        `</table>` +
        `<div style="margin-top:6px;padding:4px 8px;background:#f0fdf4;border-radius:4px;font-size:10px;color:#065f46;text-align:center">` +
        `APP Iniciativa Privada · Sin recursos públicos` +
        `</div>` +
        `</div>`
      );
      const bounds = new google.maps.LatLngBounds();
      DIAMANTE_POLYGON.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
      iw.setPosition(bounds.getCenter());
      iw.open(map);
    });
    add(diamante);

    // Diamante label marker
    const diamanteMarker = new google.maps.Marker({
      position: { lat: DIAMANTE_CENTER.lat, lng: DIAMANTE_CENTER.lng },
      map,
      title: "Diamante de Béisbol — 1,100 celdas",
      label: { text: "◆", color: "#fff", fontSize: "18px", fontWeight: "bold" },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 20,
        fillColor: "#059669",
        fillOpacity: 0.95,
        strokeColor: "#34d399",
        strokeWeight: 3,
      },
      zIndex: 100,
    });
    diamanteMarker.addListener("click", () => diamante.getPath() && google.maps.event.trigger(diamante, "click"));
    add(diamanteMarker);

    // ── Walking distance rings from Diamante (3min, 5min, 8min) ──
    if (vis("events-radius")) {
      const WALK_RINGS = [
        { meters: 240, label: "3 min", color: "#10b981" },
        { meters: 400, label: "5 min", color: "#f59e0b" },
        { meters: 640, label: "8 min", color: "#ef4444" },
      ];
      WALK_RINGS.forEach((ring) => {
        const circle = new google.maps.Circle({
          center: { lat: DIAMANTE_CENTER.lat, lng: DIAMANTE_CENTER.lng },
          radius: ring.meters,
          fillOpacity: 0,
          strokeColor: ring.color,
          strokeWeight: 1.5,
          strokeOpacity: 0.5,
          map,
        });
        // Label at top of circle
        const labelLat = DIAMANTE_CENTER.lat + (ring.meters / 111320);
        const labelMarker = new google.maps.Marker({
          position: { lat: labelLat, lng: DIAMANTE_CENTER.lng },
          map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: `🚶 ${ring.label}`,
            fontSize: "10px",
            color: ring.color,
            fontWeight: "bold",
          },
        });
        add(circle);
        add(labelMarker);
      });
    }

    // ── Comuna 11 boundary ──
    if (vis("urban-comuna") && comuna11) {
      const features = comuna11.features || [comuna11];
      features.forEach((f: any) => {
        const coords = f.geometry?.coordinates;
        if (!coords) return;
        const ring = f.geometry.type === "MultiPolygon" ? coords[0][0] : coords[0];
        const poly = new google.maps.Polygon({
          paths: ring.map(([lng, lat]: number[]) => ({ lat, lng })),
          fillColor: "#3b82f6",
          fillOpacity: 0.03,
          strokeColor: "#60a5fa",
          strokeWeight: 2,
          strokeOpacity: 0.7,
          map,
        });
        add(poly);
      });
    }

    // ── Stadium footprint ──
    if (vis("urban-stadium") && stadium) {
      stadium.features.forEach((f: any) => {
        if (f.geometry?.type === "Polygon") {
          const poly = new google.maps.Polygon({
            paths: f.geometry.coordinates[0].map(([lng, lat]: number[]) => ({ lat, lng })),
            fillColor: "#22c55e",
            fillOpacity: 0.35,
            strokeColor: "#22c55e",
            strokeWeight: 1.5,
            map,
          });
          add(poly);
        }
      });
    }

    // ── Study area full road network (703 segments, POT hierarchy) — SELECTABLE ──
    if (vis("urban-roads") && studyRoads) {
      const POT_COLORS: Record<string, string> = {
        "Arteria Principal": "#ef4444",
        "Colectora": "#f59e0b",
        "Local Principal": "#3b82f6",
        "Local": "#ffffff30",
        "Servicio": "#ffffff15",
        "Peatonal": "#22c55e60",
      };
      const POT_WEIGHTS: Record<string, number> = {
        "Arteria Principal": 3.5,
        "Colectora": 2.5,
        "Local Principal": 2,
        "Local": 1.2,
        "Servicio": 0.8,
        "Peatonal": 1,
      };
      const SELECTED_COLOR = "#00ff88";
      const SELECTED_WEIGHT_BOOST = 2;

      studyRoads.features.forEach((f: any) => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return;
        const viaPot = f.properties?.via_pot || "Local";
        const roadId = String(f.properties?.id || f.properties?.name || `road_${Math.random()}`);
        const isSelected = selectedRoadIds.includes(roadId);

        const line = new google.maps.Polyline({
          path: coords.map(([lng, lat]: number[]) => ({ lat, lng })),
          strokeColor: isSelected ? SELECTED_COLOR : (POT_COLORS[viaPot] || "#ffffff20"),
          strokeWeight: (POT_WEIGHTS[viaPot] || 1) + (isSelected ? SELECTED_WEIGHT_BOOST : 0),
          strokeOpacity: isSelected ? 1.0 : 0.7,
          map,
          zIndex: isSelected ? 50 : 1,
        });
        line.addListener("click", () => {
          // Toggle road selection
          if (onToggleRoad) {
            onToggleRoad(roadId);
          }
          // Also show info
          iw.setContent(
            `<div style="max-width:220px">` +
            `<b>${f.properties?.name || "Sin nombre"}</b><br>` +
            `Clasificación: ${viaPot}` +
            (f.properties?.lanes ? ` · ${f.properties.lanes} carriles` : "") +
            (f.properties?.oneway === "yes" ? " · Un sentido" : "") +
            `<br><span style="color:${isSelected ? '#ef4444' : '#00ff88'};font-size:11px;cursor:pointer">${isSelected ? '✕ Deseleccionar' : '✓ Click para seleccionar'}</span>` +
            `</div>`
          );
          iw.setPosition(line.getPath().getAt(Math.floor(line.getPath().getLength() / 2)));
          iw.open(map);
        });
        add(line);
      });
    }

    // ── Parking polygons (OSM real shapes) ──
    if (vis("parking-existing") && parkingPolygons) {
      parkingPolygons.features.forEach((f: any) => {
        if (f.geometry?.type === "Polygon") {
          const poly = new google.maps.Polygon({
            paths: f.geometry.coordinates[0].map(([lng, lat]: number[]) => ({ lat, lng })),
            fillColor: "#f59e0b",
            fillOpacity: 0.3,
            strokeColor: "#f59e0b",
            strokeWeight: 1.5,
            map,
          });
          poly.addListener("click", () => {
            const p = f.properties;
            iw.setContent(
              `<div style="max-width:200px"><b>${p.name || "Parqueadero"}</b><br>` +
              `Área: ${Math.round(p.area_m2)} m²<br>` +
              `Capacidad est.: ~${p.estimated_capacity} celdas<br>` +
              (p.capacity_osm ? `Capacidad OSM: ${p.capacity_osm}<br>` : "") +
              (p.fee ? `Tarifa: ${p.fee}<br>` : "") +
              `<span style="color:#999;font-size:10px">Fuente: OpenStreetMap</span></div>`
            );
            // Center info window on polygon
            const bounds = new google.maps.LatLngBounds();
            f.geometry.coordinates[0].forEach(([lng, lat]: number[]) => bounds.extend({ lat, lng }));
            iw.setPosition(bounds.getCenter());
            iw.open(map);
          });
          add(poly);
        }
      });
    }

    // ── Individual parking spaces (6,927 rectangles) ──
    if (vis("parking-spaces") && parkingSpaces) {
      parkingSpaces.features.forEach((f: any) => {
        const p = f.properties;
        const coords = f.geometry?.coordinates?.[0];
        if (!coords || coords.length < 4) return;

        let fillColor: string;
        let fillOpacity: number;
        let strokeColor: string;
        let zIdx: number;

        if (p.type === "diamante") {
          // Diamante proposed spaces — emerald green, always "available"
          fillColor = "#10b981";
          fillOpacity = 0.7;
          strokeColor = "#34d399";
          zIdx = 60;
        } else if (p.occupied) {
          // Occupied — red
          fillColor = "#ef4444";
          fillOpacity = 0.65;
          strokeColor = "#dc2626";
          zIdx = 40;
        } else {
          // Available — green
          fillColor = "#22c55e";
          fillOpacity = 0.55;
          strokeColor = "#16a34a";
          zIdx = 40;
        }

        const poly = new google.maps.Polygon({
          paths: coords.map(([lng, lat]: number[]) => ({ lat, lng })),
          fillColor,
          fillOpacity,
          strokeColor,
          strokeWeight: 0.5,
          strokeOpacity: 0.8,
          map,
          zIndex: zIdx,
        });

        poly.addListener("click", () => {
          const status = p.type === "diamante" ? "Propuesto" : (p.occupied ? "Ocupado" : "Disponible");
          const statusColor = p.type === "diamante" ? "#10b981" : (p.occupied ? "#ef4444" : "#22c55e");
          const icon = p.type === "diamante" ? "◆" : (p.occupied ? "🚗" : "✓");
          iw.setContent(
            `<div style="text-align:center;min-width:140px">` +
            `<div style="font-size:20px">${icon}</div>` +
            `<b style="color:${statusColor}">${status}</b><br>` +
            `<span style="color:#666;font-size:11px">${p.type === "street" ? "Parqueo en vía" : (p.type === "diamante" ? "Diamante de Béisbol" : "Parqueadero formal")}</span><br>` +
            (p.lot_name ? `<span style="font-size:10px;color:#999">${p.lot_name}</span><br>` : "") +
            (p.road_name ? `<span style="font-size:10px;color:#999">${p.road_name}</span><br>` : "") +
            `<span style="font-size:9px;color:#bbb">Celda: 2.50m × 5.50m</span>` +
            `</div>`
          );
          const bounds = new google.maps.LatLngBounds();
          coords.forEach(([lng, lat]: number[]) => bounds.extend({ lat, lng }));
          iw.setPosition(bounds.getCenter());
          iw.open(map);
        });
        add(poly);
      });
    }

    // ── Traffic corridors (with SIMM real speed data when available) ──
    if (vis("traffic-corridors") && corridors) {
      // Build a lookup map from speedProfiles: "corredor" → hour → avg speed
      const simmSpeeds: Record<string, Record<number, { vel: number; int: number }>> = {};
      if (speedProfiles) {
        for (const sp of speedProfiles) {
          const key = sp.corredor.toLowerCase();
          if (!simmSpeeds[key]) simmSpeeds[key] = {};
          // Average across sentidos for this corredor+hour
          if (!simmSpeeds[key][sp.hora]) {
            simmSpeeds[key][sp.hora] = { vel: sp.velocidad_promedio_kmh, int: sp.intensidad_promedio };
          } else {
            const existing = simmSpeeds[key][sp.hora];
            existing.vel = (existing.vel + sp.velocidad_promedio_kmh) / 2;
            existing.int = (existing.int + sp.intensidad_promedio) / 2;
          }
        }
      }

      corridors.forEach((c) => {
        const hv = c.hourly.find((h) => h.hour === hour) ?? c.hourly[0];
        if (!hv) return;
        const adj = applyScenarioToTraffic(hv, scenario, hour);

        // Try to find SIMM real speed for this corridor and hour
        const corridorKey = c.name.toLowerCase()
          .replace("avenida ", "").replace("av. ", "").replace("carrera ", "cra ").replace("calle ", "cll ");
        let simmSpeed: number | null = null;
        let simmSource = false;
        for (const [simmKey, hours] of Object.entries(simmSpeeds)) {
          // Fuzzy match: check if corridor name contains SIMM corredor or vice versa
          const simmLower = simmKey.toLowerCase();
          if (corridorKey.includes(simmLower) || simmLower.includes(corridorKey) ||
              c.name.toLowerCase().includes(simmLower) || simmLower.includes(c.name.toLowerCase())) {
            if (hours[hour]) {
              simmSpeed = hours[hour].vel;
              simmSource = true;
              break;
            }
          }
        }

        const displaySpeed = simmSpeed ?? adj.avgSpeed;
        const line = new google.maps.Polyline({
          path: c.coordinates.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: speedToColor(displaySpeed),
          strokeWeight: 3 + (adj.total / 2000) * 5,
          strokeOpacity: 0.85,
          map,
        });
        line.addListener("click", () => {
          iw.setContent(
            `<b>${c.name}</b><br>` +
            `${adj.total} veh/hr · ${displaySpeed.toFixed(1)} km/h` +
            (simmSource ? `<br><span style="color:#22c55e;font-size:10px">✓ Velocidad SIMM oficial</span>` : `<br><span style="color:#f59e0b;font-size:10px">~ Velocidad estimada</span>`)
          );
          iw.setPosition(line.getPath().getAt(Math.floor(line.getPath().getLength() / 2)));
          iw.open(map);
        });
        add(line);
      });
    }

    // ── OD Routes ──
    if (vis("traffic-od") && odRoutes) {
      const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#f59e0b", "#6366f1", "#14b8a6"];
      odRoutes.forEach((od, i) => {
        const route = od.routes?.[0];
        if (!route?.coordinates) return;
        const line = new google.maps.Polyline({
          path: route.coordinates.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: COLORS[i % COLORS.length],
          strokeWeight: 3.5,
          strokeOpacity: 0.75,
          map,
        });
        line.addListener("click", () => {
          iw.setContent(`<b>${od.origin}</b><br>${route.durationText || Math.round(route.duration / 60) + " min"} · ${(route.distance / 1000).toFixed(1)} km`);
          iw.setPosition(line.getPath().getAt(Math.floor(line.getPath().getLength() / 2)));
          iw.open(map);
        });
        add(line);
      });
    }

    // ── Isochrones driving ──
    if (vis("isochrone-driving") && isochrones?.driving) {
      const colors = ["#3b82f680", "#6366f160", "#8b5cf640"];
      isochrones.driving.features.forEach((f: any, i: number) => {
        if (f.geometry?.type === "Polygon") {
          const poly = new google.maps.Polygon({
            paths: f.geometry.coordinates[0].map(([lng, lat]: number[]) => ({ lat, lng })),
            fillColor: ["#3b82f6", "#6366f1", "#8b5cf6"][i],
            fillOpacity: 0.1,
            strokeColor: ["#3b82f6", "#6366f1", "#8b5cf6"][i],
            strokeWeight: 1.5,
            strokeOpacity: 0.5,
            map,
          });
          add(poly);
        }
      });
    }

    // ── Isochrones walking ──
    if (vis("isochrone-walking") && isochrones?.walking) {
      isochrones.walking.features.forEach((f: any, i: number) => {
        if (f.geometry?.type === "Polygon") {
          const poly = new google.maps.Polygon({
            paths: f.geometry.coordinates[0].map(([lng, lat]: number[]) => ({ lat, lng })),
            fillColor: ["#22c55e", "#16a34a", "#15803d"][i],
            fillOpacity: 0.1,
            strokeColor: ["#22c55e", "#16a34a", "#15803d"][i],
            strokeWeight: 1.5,
            strokeOpacity: 0.5,
            map,
          });
          add(poly);
        }
      });
    }

    // ── Parking markers ──
    if (vis("parking-existing") && parking) {
      parking.forEach((p) => {
        const marker = new google.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map,
          title: p.name,
          label: { text: "P", color: "#fff", fontSize: "10px", fontWeight: "bold" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#f59e0b",
            fillOpacity: 0.9,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          iw.setContent(
            `<div style="max-width:220px"><b>${p.name}</b><br>` +
            `Capacidad: ~${p.capacity} celdas (${(p as any).carSpaces ?? '?'} carros, ${(p as any).motoSpaces ?? '?'} motos)<br>` +
            `Tarifa: $${(p.tarifaMin ?? 0).toLocaleString()}-$${(p.tarifaMax ?? 0).toLocaleString()}/hr` +
            (p.rating ? `<br>Rating: ${p.rating} (${p.reviewCount} reviews)` : "") +
            (p.walkingTimeSeconds ? `<br>Caminata: ${Math.round(p.walkingTimeSeconds / 60)} min` : "") +
            `</div>`
          );
          iw.open(map, marker);
        });
        add(marker);
      });
    }

    // ── Hotel markers ──
    if (vis("commerce-hotels") && hotels) {
      hotels.forEach((h) => {
        const marker = new google.maps.Marker({
          position: { lat: h.lat, lng: h.lng },
          map,
          title: h.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#a855f7",
            fillOpacity: 0.85,
            strokeColor: "#fff",
            strokeWeight: 1.5,
          },
        });
        marker.addListener("click", () => {
          iw.setContent(`<b>${h.name}</b><br>${h.category}${h.rating ? ` · ${h.rating}★` : ""}${h.reviewCount ? ` (${h.reviewCount})` : ""}`);
          iw.open(map, marker);
        });
        add(marker);
      });
    }

    // ── Incidents ──
    if (vis("traffic-incidents") && incidents) {
      incidents.forEach((inc) => {
        const circle = new google.maps.Circle({
          center: { lat: inc.lat, lng: inc.lng },
          radius: inc.severity === "grave" ? 20 : 12,
          fillColor: inc.severity === "grave" ? "#f97316" : "#ef4444",
          fillOpacity: 0.45,
          strokeColor: "#fff",
          strokeWeight: 0.5,
          map,
        });
        add(circle);
      });
    }

    // ── Impact radii ──
    if (vis("events-radius")) {
      IMPACT_RADII.forEach((r) => {
        const circle = new google.maps.Circle({
          center: { lat: DIAMANTE_CENTER.lat, lng: DIAMANTE_CENTER.lng },
          radius: r,
          fillOpacity: 0,
          strokeColor: "#f59e0b",
          strokeWeight: 1.5,
          strokeOpacity: 0.6,
          map,
        });
        add(circle);
      });
    }

    // ── Commerce restaurants ──
    if (vis("commerce-restaurants") && commerce) {
      commerce
        .filter((c) => ["restaurant", "cafe", "bar", "fast_food"].includes(c.category))
        .forEach((r) => {
          const circle = new google.maps.Circle({
            center: { lat: r.lat, lng: r.lng },
            radius: 12,
            fillColor: "#f97316",
            fillOpacity: 0.55,
            strokeWeight: 0,
            map,
          });
          add(circle);
        });
    }

    // ── Commerce shops ──
    if (vis("commerce-shops") && commerce) {
      commerce
        .filter((c) => ["shop", "bank", "pharmacy", "supermarket", "bakery"].includes(c.category))
        .forEach((s) => {
          const circle = new google.maps.Circle({
            center: { lat: s.lat, lng: s.lng },
            radius: 10,
            fillColor: "#06b6d4",
            fillOpacity: 0.55,
            strokeWeight: 0,
            map,
          });
          add(circle);
        });
    }

    // ── Sports venues ──
    if (vis("commerce-sports") && sports) {
      sports.forEach((s) => {
        const circle = new google.maps.Circle({
          center: { lat: s.lat, lng: s.lng },
          radius: 18,
          fillColor: "#22c55e",
          fillOpacity: 0.55,
          strokeColor: "#fff",
          strokeWeight: 1,
          map,
        });
        add(circle);
      });
    }

    // ── Closure routes (alternative paths when roads close) ──
    if (vis("traffic-closures") && closureRoutes) {
      closureRoutes.forEach((cr: any) => {
        if (!cr.coordinates) return;
        const isClosure = cr.scenario?.includes("closure");
        const line = new google.maps.Polyline({
          path: cr.coordinates.map(([lng, lat]: number[]) => ({ lat, lng })),
          strokeColor: isClosure ? "#ef4444" : "#22c55e",
          strokeWeight: isClosure ? 4 : 3,
          strokeOpacity: 0.7,
          map,
          icons: isClosure ? [{
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#fff", scale: 3 },
            offset: "0",
            repeat: "15px",
          }] : undefined,
        });
        line.addListener("click", () => {
          iw.setContent(
            `<b>${cr.origin}</b><br>` +
            `${cr.scenario === "normal" ? "Ruta normal" : "Ruta alterna (cierre)"}<br>` +
            `${cr.durationText || Math.round(cr.duration / 60) + " min"} · ${(cr.distance / 1000).toFixed(1)} km`
          );
          iw.setPosition(line.getPath().getAt(Math.floor(line.getPath().getLength() / 2)));
          iw.open(map);
        });
        add(line);
      });
    }

    // ── Attractions / POIs de interés ──
    if (vis("commerce-attractions") && attractions) {
      attractions.forEach((a) => {
        const marker = new google.maps.Marker({
          position: { lat: a.lat, lng: a.lng },
          map,
          title: a.name,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#f43f5e",
            fillOpacity: 0.9,
            strokeColor: "#fff",
            strokeWeight: 1.5,
          },
        });
        marker.addListener("click", () => {
          iw.setContent(`<b>${a.name}</b><br>${a.subcategory || a.category}${a.rating ? ` · ${a.rating}★` : ""}`);
          iw.open(map, marker);
        });
        add(marker);
      });
    }
  }, [googleLoaded, scenario, hour, corridors, parking, commerce, hotels, sports, incidents, odRoutes, isochrones, comuna11, stadium, closureRoutes, attractions, studyRoads, parkingPolygons, manzanas, speedProfiles, parkingSpaces, selectedRoadIds, vis]);

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Loading state */}
      {!googleLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white/60 text-sm">Cargando Google Maps...</div>
        </div>
      )}

      {/* Layer Control */}
      <div className="absolute top-3 left-3 z-10">
        <LayerControl visibility={layerVisibility} onToggle={onToggleLayer} />
      </div>

      {/* Road Selection Badge */}
      {selectedRoadIds.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-emerald-600/90 backdrop-blur-sm px-4 py-1.5 shadow-lg border border-emerald-400/30">
          <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-sm font-medium text-white">
            {selectedRoadIds.length} calle{selectedRoadIds.length !== 1 ? "s" : ""} seleccionada{selectedRoadIds.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onClearSelection}
            className="ml-1 text-xs text-emerald-200 hover:text-white transition-colors underline"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Floating KPI strip — bottom left */}
      <div className="absolute bottom-4 left-3 z-10 flex gap-1.5">
        <FloatingKPI label="TPD Polígono" value="68,787" unit="veh/día" color="#3b82f6" />
        <FloatingKPI label="Celdas totales" value="6,927" unit="zona estudio" color="#f59e0b" />
        <FloatingKPI label="Diamante" value="+1,100" unit="propuestas" color="#10b981" />
        <FloatingKPI label="Vía pública" value="5,005" unit="informales" color="#ef4444" />
      </div>

      {/* Scenario indicator */}
      <div className="absolute top-14 right-3 z-10">
        <div className="rounded-lg bg-gray-900/80 backdrop-blur-sm border border-white/10 px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: scenario.color }} />
            <div>
              <div className="text-xs font-semibold text-white">{scenario.name}</div>
              {scenario.attendance > 0 && (
                <div className="text-[10px] text-white/40">{scenario.attendance.toLocaleString()} asistentes</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-3 z-10">
        <MapLegend scenario={scenario} layerVisibility={layerVisibility} />
      </div>
    </div>
  );
}

function FloatingKPI({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-lg bg-gray-900/85 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 shadow-lg min-w-[80px]">
      <div className="text-[9px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-white/30">{unit}</div>
    </div>
  );
}
