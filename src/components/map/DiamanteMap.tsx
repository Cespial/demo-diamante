"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Scenario, TrafficCorridor, ParkingPOI, CommercePOI, TrafficIncident, ODRoute } from "@/types";
import { DIAMANTE_CENTER, MAP_DEFAULT_ZOOM, IMPACT_RADII, DIAMANTE_POLYGON } from "@/data/diamante-config";
import { applyScenarioToTraffic } from "@/lib/scenario-engine";
import { speedToColor } from "@/lib/mapbox-utils";
import { useData } from "@/lib/hooks";
import { LayerControl } from "./LayerControl";
import { MapLegend } from "./MapLegend";

const GOOGLE_API_KEY = "AIzaSyCDtpnJoftns_RXlJhDkLrLwOmdDPoQy10";

interface DiamanteMapProps {
  scenario: Scenario;
  hour: number;
  layerVisibility: Record<string, boolean>;
  onToggleLayer: (id: string) => void;
}

// Load Google Maps script once
function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps) { setLoaded(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener("load", () => setLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=visualization&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

export function DiamanteMap({ scenario, hour, layerVisibility, onToggleLayer }: DiamanteMapProps) {
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
  const { data: pedIntensity } = useData<GeoJSON.FeatureCollection>("/data/pedestrian-intensity.json");

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

    // ── Diamante polygon ──
    const diamante = new google.maps.Polygon({
      paths: DIAMANTE_POLYGON.map(([lng, lat]) => ({ lat, lng })),
      fillColor: "#3b82f6",
      fillOpacity: 0.45,
      strokeColor: "#60a5fa",
      strokeWeight: 2.5,
      map,
    });
    add(diamante);

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

    // ── Traffic corridors ──
    if (vis("traffic-corridors") && corridors) {
      corridors.forEach((c) => {
        const hv = c.hourly.find((h) => h.hour === hour) ?? c.hourly[0];
        if (!hv) return;
        const adj = applyScenarioToTraffic(hv, scenario, hour);
        const line = new google.maps.Polyline({
          path: c.coordinates.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: speedToColor(adj.avgSpeed),
          strokeWeight: 3 + (adj.total / 2000) * 5,
          strokeOpacity: 0.85,
          map,
        });
        line.addListener("click", () => {
          iw.setContent(`<b>${c.name}</b><br>${adj.total} veh/hr · ${adj.avgSpeed} km/h`);
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
            `Capacidad: ~${p.capacity} celdas<br>` +
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

    // ── Pedestrian intensity heatmap ──
    if (vis("personas-heatmap") && pedIntensity?.features) {
      const heatmapData = pedIntensity.features
        .filter((f: any) => f.properties?.weight > 0.1)
        .map((f: any) => ({
          location: new google.maps.LatLng(
            f.geometry.coordinates[1],
            f.geometry.coordinates[0]
          ),
          weight: f.properties.weight,
        }));
      if (heatmapData.length > 0 && (google.maps as any).visualization) {
        const heatmap = new (google.maps as any).visualization.HeatmapLayer({
          data: heatmapData,
          radius: 40,
          opacity: 0.6,
          map,
        });
        add(heatmap);
      }
    }
  }, [googleLoaded, scenario, hour, corridors, parking, commerce, hotels, sports, incidents, odRoutes, isochrones, comuna11, stadium, closureRoutes, pedIntensity, vis]);

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

      {/* Legend */}
      <div className="absolute bottom-6 right-3 z-10">
        <MapLegend scenario={scenario} />
      </div>
    </div>
  );
}
