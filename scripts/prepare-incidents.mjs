#!/usr/bin/env node
/**
 * prepare-incidents.mjs
 * Reads REAL traffic incident data from HPTU CSV (270k+ rows),
 * filters for Comuna 11 (Laureles-Estadio), keeps only the most
 * recent 2 years, and outputs TrafficIncident[] JSON.
 */
import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const SRC = "/Users/cristianespinal/Claude Code/data-lake/salud/hptu-localizacion/raw/incidentes_viales.csv";

/* ---------- severity mapping ---------- */
const SEVERITY_MAP = {
  "solo daños": "leve",
  "solo danos": "leve",
  "con heridos": "grave",
  "con muerto": "fatal",
};

function mapSeverity(raw) {
  const key = (raw || "").trim().toLowerCase();
  return SEVERITY_MAP[key] || "leve";
}

/* ---------- parse LOCATION "[-75.xxx, 6.xxx]" ---------- */
function parseLocation(loc) {
  if (!loc) return null;
  const m = loc.match(/\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]/);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lon) || isNaN(lat)) return null;
  // Sanity: Medellín is roughly lon -75.4..-75.7, lat 6.1..6.4
  if (lon < -76.5 || lon > -74.5 || lat < 5.5 || lat > 7.0) return null;
  return { lat, lng: lon };
}

/* ---------- parse date string ---------- */
// FECHA_ACCIDENTES is ISO: "2015-10-18T09:40:00.000Z"
// FECHA_ACCIDENTE is "DD/MM/YYYY HH:MM:SS"
function parseDate(isoStr, localStr) {
  // prefer the ISO field
  if (isoStr && isoStr.includes("T")) {
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), year: d.getUTCFullYear() };
    }
  }
  // fallback: DD/MM/YYYY HH:MM:SS
  if (localStr) {
    const m = localStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})/);
    if (m) {
      const day = m[1], mon = m[2], yr = m[3], hr = parseInt(m[4], 10);
      return { date: `${yr}-${mon}-${day}`, hour: hr, year: parseInt(yr, 10) };
    }
  }
  return null;
}

/* ---------- proper CSV line parser (handles quoted fields) ---------- */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/* ---------- main ---------- */
export default async function prepareIncidents() {
  console.log("  [incidents] Reading CSV:", SRC);

  const headers = [];
  const allRows = []; // will hold { year, record } for comuna 11

  await new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(SRC, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    let lineNum = 0;

    rl.on("line", (line) => {
      lineNum++;
      // strip trailing \r
      line = line.replace(/\r$/, "");

      if (lineNum === 1) {
        // parse headers
        const h = parseCSVLine(line);
        h.forEach((col) => headers.push(col));
        return;
      }

      const fields = parseCSVLine(line);
      // build object
      const row = {};
      headers.forEach((h, i) => (row[h] = fields[i] || ""));

      // filter: NUMCOMUNA = "11"
      if ((row.NUMCOMUNA || "").trim() !== "11") return;

      // parse date
      const dt = parseDate(row.FECHA_ACCIDENTES, row.FECHA_ACCIDENTE);
      if (!dt) return;

      // parse location
      const loc = parseLocation(row.LOCATION);
      if (!loc) return;

      allRows.push({
        year: dt.year,
        record: {
          lat: loc.lat,
          lng: loc.lng,
          type: (row.CLASE_ACCIDENTE || "").trim(),
          severity: mapSeverity(row.GRAVEDAD_ACCIDENTE),
          date: dt.date,
          hour: dt.hour,
          barrio: (row.BARRIO || "").trim(),
        },
      });
    });

    rl.on("close", resolve);
    rl.on("error", reject);
  });

  console.log(`  [incidents] Total Comuna 11 rows with valid coords: ${allRows.length}`);

  // determine 2 most recent years
  const yearCounts = {};
  for (const r of allRows) {
    yearCounts[r.year] = (yearCounts[r.year] || 0) + 1;
  }
  const sortedYears = Object.keys(yearCounts)
    .map(Number)
    .sort((a, b) => b - a);

  console.log("  [incidents] Year distribution (all comuna 11):");
  for (const y of sortedYears) {
    console.log(`    ${y}: ${yearCounts[y]}`);
  }

  const keepYears = new Set(sortedYears.slice(0, 2));
  console.log(`  [incidents] Keeping most recent 2 years: ${[...keepYears].sort().join(", ")}`);

  const filtered = allRows.filter((r) => keepYears.has(r.year));
  console.log(`  [incidents] Rows after year filter: ${filtered.length}`);

  // build final output
  const incidents = filtered.map((r, i) => ({
    id: `INC-${r.record.date.slice(0, 4)}-${String(i + 1).padStart(5, "0")}`,
    lat: Math.round(r.record.lat * 1e6) / 1e6,
    lng: Math.round(r.record.lng * 1e6) / 1e6,
    type: r.record.type,
    severity: r.record.severity,
    date: r.record.date,
    hour: r.record.hour,
    barrio: r.record.barrio,
  }));

  // summary stats
  const byType = {};
  const bySeverity = {};
  const byMonth = {};
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const byBarrio = {};

  for (const inc of incidents) {
    byType[inc.type] = (byType[inc.type] || 0) + 1;
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    const m = inc.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
    byHour[inc.hour].count++;
    byBarrio[inc.barrio] = (byBarrio[inc.barrio] || 0) + 1;
  }

  const data = {
    incidents,
    summary: {
      total: incidents.length,
      years: [...keepYears].sort(),
      by_type: byType,
      by_severity: bySeverity,
      by_month: byMonth,
      by_hour: byHour,
      top_barrios: Object.entries(byBarrio)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, count]) => ({ name, count })),
    },
    source: "HPTU - incidentes_viales.csv",
    generated: new Date().toISOString(),
  };

  const outPath = resolve(OUT, "incidents-laureles.json");
  writeFileSync(outPath, JSON.stringify(data));
  const sizeMB = (Buffer.byteLength(JSON.stringify(data)) / 1024 / 1024).toFixed(2);
  console.log(`  [incidents] Wrote ${outPath}`);
  console.log(`  [incidents] ${incidents.length} incidents, ${sizeMB} MB`);

  // print summary
  console.log("\n  --- Summary ---");
  console.log(`  Total incidents: ${incidents.length}`);
  console.log("  By severity:");
  for (const [k, v] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`);
  }
  console.log("  By type (top 10):");
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${k}: ${v}`);
  }
  console.log("  Top 5 barrios:");
  for (const b of data.summary.top_barrios.slice(0, 5)) {
    console.log(`    ${b.name}: ${b.count}`);
  }

  return data;
}

if (process.argv[1] && process.argv[1].endsWith("prepare-incidents.mjs")) {
  prepareIncidents().catch(console.error);
}
