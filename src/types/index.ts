// ── GeoJSON helpers ──
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ── Traffic ──
export interface TrafficCorridor {
  id: string;
  name: string;
  coordinates: [number, number][];
  hourly: HourlyVolume[];
}

export interface HourlyVolume {
  hour: number;
  autos: number;
  motos: number;
  buses: number;
  camiones: number;
  bicicletas: number;
  total: number;
  avgSpeed: number;
}

export interface TrafficAforo {
  intersection: string;
  lat: number;
  lng: number;
  hourly: HourlyVolume[];
  source?: "SIMM_oficial" | "estimado";
  via_principal?: string;
  via_secundaria?: string;
}

// ── Parking ──
export interface ParkingPOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  carSpaces?: number;
  motoSpaces?: number;
  tarifaMin: number;
  tarifaMax: number;
  type: string;
  source: string;
  rating?: number | null;
  reviewCount?: number;
  address?: string;
  openingHours?: string[];
  phone?: string | null;
  website?: string | null;
  walkingTimeSeconds?: number;
  walkingDistanceMeters?: number;
}

// ── Commerce ──
export interface CommercePOI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: CommerceCategory;
  subcategory: string;
  rating?: number | null;
  reviewCount?: number;
  priceLevel?: string | null;
  address?: string;
  openingHours?: string[];
}

export type CommerceCategory =
  | "restaurant"
  | "cafe"
  | "bar"
  | "fast_food"
  | "hotel"
  | "hostel"
  | "shop"
  | "bank"
  | "pharmacy"
  | "clinic"
  | "sports"
  | "fitness"
  | "stadium"
  | "spa"
  | "bakery"
  | "supermarket"
  | "attraction"
  | "museum";

// ── OD Routes ──
export interface ODRoute {
  origin: string;
  originLat: number;
  originLng: number;
  routes: {
    index: number;
    distance: number;
    duration: number;
    durationText: string;
    coordinates: [number, number][];
    label: string;
  }[];
}

// ── Macro Context ──
export interface MacroContext {
  population: {
    comuna11: number;
    catchmentArea: number;
  };
  commercialRents: {
    laureles: { min: number; max: number };
    nearStadium: { min: number; max: number };
  };
  macro: {
    trm: number;
    ipc: number;
    tasaInteres: number;
  };
  businessCount: {
    laureles_estadio: number;
  };
}

// ── Events ──
export interface CalendarEvent {
  id: string;
  name: string;
  type: EventType;
  date: string;
  attendance: number;
  duration: number; // hours
  peakHour: number;
  recurrence: "weekly" | "biweekly" | "monthly" | "annual" | "one-time";
}

export type EventType =
  | "partido_liga"
  | "clasico"
  | "concierto"
  | "liga_nocturna"
  | "feria"
  | "otro";

export interface HotelOccupancy {
  month: string;
  baseOccupancy: number;
  eventUplift: number;
  totalOccupancy: number;
}

// ── Urban / POT ──
export interface UrbanLicense {
  id: string;
  lat: number;
  lng: number;
  tipo: string;
  estado: string;
  area: number;
  fecha: string;
}

export interface POTConstraint {
  id: string;
  name: string;
  value: string;
  category: "uso_suelo" | "altura" | "indice_ocupacion" | "indice_construccion" | "retiros" | "estacionamientos";
  description: string;
}

// ── Metro ──
export interface MetroRidership {
  station: string;
  month: string;
  entries: number;
  exits: number;
}

// ── Incidents ──
export interface TrafficIncident {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: "leve" | "grave" | "fatal";
  date: string;
  hour: number;
}

// ── Isochrones ──
export interface IsochroneData {
  driving: GeoJSON.FeatureCollection;
  walking: GeoJSON.FeatureCollection;
}

// ── Scenarios ──
export type ScenarioId =
  | "normal"
  | "partido_liga"
  | "clasico"
  | "concierto"
  | "liga_nocturna"
  | "feria";

export interface Scenario {
  id: ScenarioId;
  name: string;
  label: string;
  attendance: number;
  vehicleMultiplier: number;
  parkingDemand: number;
  peakHour: number;
  peakSpread: number; // gaussian sigma in hours
  surchargeMultiplier: number;
  valetActive: boolean;
  icon: string;
  color: string;
  description: string;
}

// ── Financial ──
export interface FinancialParams {
  parkingSpaces: number;
  parkingFloors: number;
  baseTariff: number;
  maxTariff: number;
  monthlyPassPrice: number;
  monthlyPassSlots: number;
  valetPrice: number;
  valetServicesPerEvent: number;
  commerceArea: number;
  commerceRentMin: number;
  commerceRentMax: number;
  commerceOccupancy: number;
  operatingCostPct: number;
  eventsPerYear: number;
  avgEventUplift: number;
}

export interface FinancialResult {
  parkingBase: number;
  parkingSurcharge: number;
  monthlyPasses: number;
  valetRevenue: number;
  commerceRent: number;
  totalGross: number;
  operatingCosts: number;
  netIncome: number;
}

// ── Map Layers ──
export interface MapLayer {
  id: string;
  name: string;
  group: LayerGroup;
  type: "line" | "circle" | "fill" | "fill-extrusion" | "symbol" | "heatmap";
  visible: boolean;
  source: string;
}

export type LayerGroup =
  | "trafico"
  | "parqueaderos"
  | "comercio"
  | "eventos"
  | "urbanismo";

// ── Tabs ──
export type TabId =
  | "ejecutivo"
  | "trafico"
  | "parking"
  | "comercio"
  | "personas"
  | "eventos"
  | "urbanismo"
  | "financiero"
  | "estructurador"
  | "decision";

// ── App State ──
export interface AppState {
  activeScenario: ScenarioId;
  activeTab: TabId;
  hour: number;
  layerVisibility: Record<string, boolean>;
  selectedRoadIds: string[];
}
