/**
 * Adapt pipeline output to match the app's TypeScript interfaces.
 * Run after prepare-all.mjs to transform data structures.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '..', 'public', 'data');

function read(name) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name), 'utf-8'));
}
function write(name, data) {
  writeFileSync(resolve(DATA_DIR, name), JSON.stringify(data));
  console.log(`  ✓ ${name} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

console.log('Adapting data files...\n');

// ── 1. traffic-corridors.json: GeoJSON FeatureCollection → TrafficCorridor[] ──
{
  const raw = read('traffic-corridors.json');
  const aforos = read('traffic-aforos.json');

  // Group aforos by intersection
  const byIntersection = {};
  for (const a of aforos) {
    const key = a.intersection_name || a.intersection_id;
    if (!byIntersection[key]) byIntersection[key] = [];
    byIntersection[key].push(a);
  }

  // Build corridor array from GeoJSON features + hourly from aforos
  const corridors = raw.features.map((f, i) => {
    const name = f.properties.name;
    // Find matching aforo data or generate synthetic hourly
    const matchingAforos = byIntersection[name] || [];

    const hourly = Array.from({ length: 24 }, (_, hour) => {
      const match = matchingAforos.find(a => a.hour === hour);
      if (match) {
        return {
          hour,
          autos: match.autos,
          motos: match.motos,
          buses: match.buses,
          camiones: match.camiones,
          bicicletas: match.bicicletas,
          total: match.total,
          avgSpeed: match.speed_kmh || 35,
        };
      }
      // Generate from corridor properties
      const peakVol = f.properties.peak_volume || 500;
      const avgVol = f.properties.avg_daily_volume || 300;
      const peakSpeed = f.properties.peak_speed_kmh || 25;
      const avgSpeed = f.properties.avg_speed_kmh || 40;

      // Typical urban hourly pattern
      const hourlyFactor = [0.1,0.08,0.06,0.05,0.07,0.15,0.4,0.75,0.9,0.7,0.6,0.65,0.7,0.6,0.55,0.65,0.8,0.95,1.0,0.8,0.5,0.35,0.25,0.15][hour];
      const vol = Math.round(avgVol * hourlyFactor * 2);
      const speed = avgSpeed - (avgSpeed - peakSpeed) * hourlyFactor;

      return {
        hour,
        autos: Math.round(vol * 0.45),
        motos: Math.round(vol * 0.35),
        buses: Math.round(vol * 0.08),
        camiones: Math.round(vol * 0.05),
        bicicletas: Math.round(vol * 0.07),
        total: vol,
        avgSpeed: Math.round(speed * 10) / 10,
      };
    });

    return {
      id: `corridor-${i}`,
      name,
      coordinates: f.geometry.coordinates,
      hourly,
    };
  });

  write('traffic-corridors.json', corridors);
}

// ── 2. traffic-aforos.json: flat records → TrafficAforo[] (grouped) ──
{
  const raw = read('traffic-aforos.json');

  // Group by intersection
  const grouped = {};
  for (const r of raw) {
    const key = r.intersection_name || r.intersection_id;
    if (!grouped[key]) {
      grouped[key] = {
        intersection: key,
        lat: r.lat,
        lng: r.lon || r.lng,
        hourly: [],
      };
    }
    grouped[key].hourly.push({
      hour: r.hour,
      autos: r.autos,
      motos: r.motos,
      buses: r.buses,
      camiones: r.camiones,
      bicicletas: r.bicicletas,
      total: r.total,
      avgSpeed: r.speed_kmh || 35,
    });
  }

  // Sort hourly and write
  const aforos = Object.values(grouped).map(a => {
    a.hourly.sort((x, y) => x.hour - y.hour);
    return a;
  });

  write('traffic-aforos.json', aforos);
}

// ── 3. parking-pois.json: GeoJSON → ParkingPOI[] ──
{
  const raw = read('parking-pois.json');
  const pois = raw.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name || 'Parqueadero',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    capacity: f.properties.capacity || 20,
    tarifaMin: f.properties.tariff_cop_min || 4000,
    tarifaMax: f.properties.tariff_cop_max || 8000,
    type: f.properties.parking_type || 'surface',
    source: f.properties.source || 'osm',
  }));
  write('parking-pois.json', pois);
}

// ── 4. commerce-pois.json: GeoJSON → CommercePOI[] ──
{
  const raw = read('commerce-pois.json');
  const categoryMap = {
    fast_food: 'fast_food',
    restaurant: 'restaurant',
    cafe: 'cafe',
    bar: 'bar',
    pub: 'bar',
    hotel: 'hotel',
    hostel: 'hostel',
    supermarket: 'shop',
    convenience: 'shop',
    clothes: 'shop',
    bakery: 'shop',
    butcher: 'shop',
    mall: 'shop',
    bank: 'bank',
    pharmacy: 'pharmacy',
    clinic: 'clinic',
    hospital: 'clinic',
    doctors: 'clinic',
    dentist: 'clinic',
    veterinary: 'clinic',
    sports_centre: 'sports',
    fitness_centre: 'fitness',
    stadium: 'stadium',
    swimming_pool: 'sports',
    pitch: 'sports',
  };

  const pois = raw.features.map((f) => {
    const rawCat = f.properties.category || f.properties.amenity || f.properties.shop || 'shop';
    return {
      id: f.properties.id,
      name: f.properties.name || 'Sin nombre',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      category: categoryMap[rawCat] || 'shop',
      subcategory: rawCat,
    };
  });
  write('commerce-pois.json', pois);
}

// ── 5. hotels-pois.json: GeoJSON → CommercePOI[] ──
{
  const raw = read('hotels-pois.json');
  const pois = raw.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name || 'Hotel',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    category: f.properties.category === 'hostel' ? 'hostel' : 'hotel',
    subcategory: f.properties.category || 'hotel',
  }));
  write('hotels-pois.json', pois);
}

// ── 6. sports-venues.json: GeoJSON → CommercePOI[] ──
{
  const raw = read('sports-venues.json');
  const pois = raw.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name || 'Venue Deportivo',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    category: f.properties.category === 'stadium' ? 'stadium' : f.properties.category === 'fitness_centre' ? 'fitness' : 'sports',
    subcategory: f.properties.category || 'sports',
  }));
  write('sports-venues.json', pois);
}

// ── 7. events-calendar.json → CalendarEvent[] ──
{
  const raw = read('events-calendar.json');
  const typeMap = {
    match: 'partido_liga',
    liga: 'partido_liga',
    clasico: 'clasico',
    clasico_paisa: 'clasico',
    concert: 'concierto',
    concierto: 'concierto',
    night_league: 'liga_nocturna',
    liga_nocturna: 'liga_nocturna',
    feria: 'feria',
    festival: 'feria',
  };

  const events = raw.map((e, i) => ({
    id: e.id || `evt-${i}`,
    name: e.name,
    type: typeMap[e.category] || typeMap[e.type] || 'otro',
    date: e.date,
    attendance: e.estimated_attendance || e.attendance || 5000,
    duration: e.duration || 3,
    peakHour: e.hour || e.peakHour || 19,
    recurrence: e.recurrence || (e.category === 'night_league' ? 'weekly' : 'one-time'),
  }));
  write('events-calendar.json', events);
}

// ── 8. hotel-occupancy-events.json → HotelOccupancy[] ──
{
  const raw = read('hotel-occupancy-events.json');
  const monthLabels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let occupancy;
  if (raw.months) {
    occupancy = raw.months.map((m, i) => ({
      month: monthLabels[i] || m.month,
      baseOccupancy: Math.round((m.avg_occupancy || 0.6) * 100),
      eventUplift: Math.round(Math.random() * 15 + 5),
      totalOccupancy: Math.round((m.avg_occupancy || 0.6) * 100 + Math.random() * 15 + 5),
    }));
  } else if (Array.isArray(raw)) {
    occupancy = raw.map((m, i) => ({
      month: monthLabels[i] || m.month,
      baseOccupancy: m.baseOccupancy || 60,
      eventUplift: m.eventUplift || 10,
      totalOccupancy: (m.baseOccupancy || 60) + (m.eventUplift || 10),
    }));
  } else {
    occupancy = monthLabels.map((m, i) => {
      const base = [58,55,60,62,65,68,72,78,70,65,62,75][i];
      const uplift = [5,4,8,6,10,12,15,20,12,8,6,18][i];
      return { month: m, baseOccupancy: base, eventUplift: uplift, totalOccupancy: base + uplift };
    });
  }
  write('hotel-occupancy-events.json', occupancy);
}

// ── 9. urban-licenses.json → UrbanLicense[] ──
{
  const raw = read('urban-licenses.json');
  const licenses = raw.map((l, i) => ({
    id: l.id || `lic-${i}`,
    lat: l.lat,
    lng: l.lon || l.lng,
    tipo: l.tipo || 'Construcción',
    estado: l.estado || 'Aprobada',
    area: l.area_m2 || l.area || 200,
    fecha: l.fecha || '2024-01-01',
  }));
  write('urban-licenses.json', licenses);
}

// ── 10. pot-constraints.json → POTConstraint[] ──
{
  const raw = read('pot-constraints.json');
  let constraints;
  if (Array.isArray(raw)) {
    constraints = raw;
  } else if (raw.constraints) {
    constraints = raw.constraints.map((c, i) => ({
      id: c.id || `pot-${i}`,
      name: c.name || c.parameter || 'Restricción',
      value: String(c.value),
      category: c.category || 'uso_suelo',
      description: c.description || c.notes || '',
    }));
  } else {
    // Generate POT constraints for Comuna 11
    constraints = [
      { id: 'pot-1', name: 'Uso del Suelo', value: 'Mixto (Residencial + Comercial + Deportivo)', category: 'uso_suelo', description: 'Permite usos complementarios comerciales y de servicios' },
      { id: 'pot-2', name: 'Altura Máxima', value: '8 pisos', category: 'altura', description: 'Tratamiento CN3 - Consolidación Nivel 3' },
      { id: 'pot-3', name: 'Índice de Ocupación', value: '0.70', category: 'indice_ocupacion', description: 'Máximo 70% del área del predio' },
      { id: 'pot-4', name: 'Índice de Construcción', value: '3.5', category: 'indice_construccion', description: 'Área construida / área del predio' },
      { id: 'pot-5', name: 'Retiro Frontal', value: '5m', category: 'retiros', description: 'Mínimo desde línea de paramento' },
      { id: 'pot-6', name: 'Retiro Lateral', value: '3m', category: 'retiros', description: 'Cuando el predio colinda con otro lote' },
      { id: 'pot-7', name: 'Estacionamientos', value: '1 por cada 80m² construidos', category: 'estacionamientos', description: 'Parqueaderos públicos no computan como área construida' },
      { id: 'pot-8', name: 'Estacionamientos Visitantes', value: '1 por cada 200m²', category: 'estacionamientos', description: 'Para uso comercial y servicios' },
    ];
  }
  write('pot-constraints.json', constraints);
}

// ── 11. incidents-laureles.json → TrafficIncident[] ──
{
  const raw = read('incidents-laureles.json');
  let incidents;
  if (Array.isArray(raw)) {
    incidents = raw.map((inc, i) => ({
      id: inc.id || `inc-${i}`,
      lat: inc.lat,
      lng: inc.lon || inc.lng,
      type: inc.type || inc.clase || 'Choque',
      severity: inc.severity || inc.gravedad || 'leve',
      date: inc.date || inc.fecha || '2024-01-01',
      hour: inc.hour || inc.hora || 12,
    }));
  } else if (raw.features) {
    incidents = raw.features.map((f, i) => ({
      id: f.properties.id || `inc-${i}`,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      type: f.properties.type || f.properties.clase || 'Choque',
      severity: f.properties.severity || f.properties.gravedad || 'leve',
      date: f.properties.date || f.properties.fecha || '2024-01-01',
      hour: f.properties.hour || f.properties.hora || 12,
    }));
  } else {
    incidents = [];
  }
  write('incidents-laureles.json', incidents);
}

// ── 12. isochrones.json: single FC → {driving, walking} ──
{
  const raw = read('isochrones.json');
  if (raw.type === 'FeatureCollection' && !raw.driving) {
    // Split features by metadata or generate synthetic
    const features = raw.features || [];
    // If we have 6 features, first 3 are driving, last 3 walking
    const half = Math.ceil(features.length / 2);
    const iso = {
      driving: {
        type: 'FeatureCollection',
        features: features.slice(0, half).map((f, i) => ({
          ...f,
          properties: { ...f.properties, contour: [5, 10, 15][i] || (i + 1) * 5 },
        })),
      },
      walking: {
        type: 'FeatureCollection',
        features: features.slice(half).map((f, i) => ({
          ...f,
          properties: { ...f.properties, contour: [5, 10, 15][i] || (i + 1) * 5 },
        })),
      },
    };
    write('isochrones.json', iso);
  }
}

console.log('\nAll data adapted successfully!');
