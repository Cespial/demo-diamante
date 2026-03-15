#!/usr/bin/env node
/**
 * prepare-isochrones.mjs
 * Computes high-quality isochrone polygons from real OSM road network
 * using Overpass API + Dijkstra graph traversal + concave hull.
 *
 * Output: { driving: FeatureCollection, walking: FeatureCollection }
 * Each feature has properties.contour = 5 | 10 | 15
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const CENTER = { lat: 6.2565, lng: -75.5905 };
const CONTOURS = [5, 10, 15]; // minutes
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Bounding box: generous enough for 15-min driving (~7km radius)
const BBOX = {
  south: 6.195,
  west: -75.650,
  north: 6.320,
  east: -75.530,
};

// Speed assumptions (km/h) for each road type and profile
const SPEEDS = {
  driving: {
    motorway: 80, trunk: 60, primary: 45, secondary: 35, tertiary: 30,
    residential: 25, living_street: 15, service: 15, unclassified: 25,
    motorway_link: 50, trunk_link: 40, primary_link: 35, secondary_link: 30,
    tertiary_link: 25, track: 15, default: 25,
  },
  walking: {
    footway: 4.5, path: 4.0, pedestrian: 4.5, steps: 2.5,
    cycleway: 4.5, living_street: 4.5, residential: 4.5, service: 4.5,
    tertiary: 4.5, secondary: 4.5, primary: 4.0, trunk: 0, motorway: 0,
    track: 3.5, unclassified: 4.5, default: 4.5,
    motorway_link: 0, trunk_link: 0, primary_link: 4.0, secondary_link: 4.5,
    tertiary_link: 4.5,
  },
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchRoadNetwork() {
  const query = `
[out:json][timeout:60];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|living_street|service|unclassified|footway|path|pedestrian|steps|cycleway|track|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out body;
>;
out skel qt;
`;
  console.log("  [isochrones] Fetching road network from Overpass API...");
  const resp = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(90000),
  });
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  console.log(`  [isochrones] Got ${data.elements.length} elements from Overpass`);
  return data;
}

function buildGraph(overpassData, profile) {
  const nodes = new Map(); // id -> { lat, lon }
  const adjacency = new Map(); // nodeId -> [{ to, cost_minutes }]

  // Index nodes
  for (const el of overpassData.elements) {
    if (el.type === "node") {
      nodes.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  // Build edges from ways
  const speeds = SPEEDS[profile];
  for (const el of overpassData.elements) {
    if (el.type !== "way" || !el.tags) continue;
    const highway = el.tags.highway;
    const speed = speeds[highway] ?? speeds.default;
    if (speed <= 0) continue; // not traversable

    const oneway = el.tags.oneway === "yes" || el.tags.oneway === "1";
    const reverseOneway = el.tags.oneway === "-1";

    const nds = el.nodes;
    for (let i = 0; i < nds.length - 1; i++) {
      const a = nds[i], b = nds[i + 1];
      const na = nodes.get(a), nb = nodes.get(b);
      if (!na || !nb) continue;

      const dist = haversine(na.lat, na.lon, nb.lat, nb.lon);
      const cost = (dist / speed) * 60; // minutes

      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);

      if (profile === "driving") {
        if (reverseOneway) {
          adjacency.get(b).push({ to: a, cost });
        } else if (oneway) {
          adjacency.get(a).push({ to: b, cost });
        } else {
          adjacency.get(a).push({ to: b, cost });
          adjacency.get(b).push({ to: a, cost });
        }
      } else {
        // Walking: always bidirectional
        adjacency.get(a).push({ to: b, cost });
        adjacency.get(b).push({ to: a, cost });
      }
    }
  }

  return { nodes, adjacency };
}

function findNearestNode(nodes, lat, lng) {
  let bestId = null, bestDist = Infinity;
  for (const [id, node] of nodes) {
    const d = haversine(lat, lng, node.lat, node.lon);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

// Simple Dijkstra with a binary heap-like priority queue (array-based)
function dijkstra(adjacency, startNode, maxMinutes) {
  const dist = new Map();
  dist.set(startNode, 0);

  // Priority queue: [cost, nodeId]
  const pq = [[0, startNode]];
  const visited = new Set();

  while (pq.length > 0) {
    // Find min cost entry (simple approach for moderate graph sizes)
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][0] < pq[minIdx][0]) minIdx = i;
    }
    const [cost, node] = pq[minIdx];
    pq[minIdx] = pq[pq.length - 1];
    pq.pop();

    if (visited.has(node)) continue;
    visited.add(node);

    if (cost > maxMinutes) continue;

    const neighbors = adjacency.get(node) || [];
    for (const { to, cost: edgeCost } of neighbors) {
      if (visited.has(to)) continue;
      const newCost = cost + edgeCost;
      if (newCost > maxMinutes) continue;
      const prevCost = dist.get(to);
      if (prevCost === undefined || newCost < prevCost) {
        dist.set(to, newCost);
        pq.push([newCost, to]);
      }
    }
  }

  return dist; // nodeId -> travel time in minutes
}

// Compute concave hull of reachable points for a given time contour
function computeContourPolygon(nodes, reachableNodes, contourMinutes) {
  const points = [];
  for (const [nodeId, cost] of reachableNodes) {
    if (cost <= contourMinutes) {
      const node = nodes.get(nodeId);
      if (node) points.push([node.lon, node.lat]);
    }
  }

  if (points.length < 4) return null;

  // Use convex hull as a starting point, then refine with alpha shape approach
  // For simplicity, compute convex hull and then densify boundary using reachable points
  const hull = convexHull(points);
  if (!hull || hull.length < 3) return null;

  // Close the ring
  const ring = [...hull, hull[0]];
  return ring;
}

function cross(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 1) return pts;

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Create a more detailed boundary by grid-based alpha shape approach
function computeAlphaContour(nodes, reachableNodes, contourMinutes) {
  const reachablePoints = [];
  for (const [nodeId, cost] of reachableNodes) {
    if (cost <= contourMinutes) {
      const node = nodes.get(nodeId);
      if (node) reachablePoints.push([node.lon, node.lat]);
    }
  }

  if (reachablePoints.length < 10) return null;

  // Grid-based approach: divide space into cells, mark cells that contain reachable points,
  // then trace the boundary of the reachable area
  const GRID_SIZE = 80; // cells per dimension

  // Find bounds
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of reachablePoints) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Add padding
  const padLon = (maxLon - minLon) * 0.05;
  const padLat = (maxLat - minLat) * 0.05;
  minLon -= padLon; maxLon += padLon;
  minLat -= padLat; maxLat += padLat;

  const cellW = (maxLon - minLon) / GRID_SIZE;
  const cellH = (maxLat - minLat) / GRID_SIZE;

  // Create grid and mark cells
  const grid = Array.from({ length: GRID_SIZE }, () => new Uint8Array(GRID_SIZE));

  for (const [lon, lat] of reachablePoints) {
    const col = Math.min(GRID_SIZE - 1, Math.floor((lon - minLon) / cellW));
    const row = Math.min(GRID_SIZE - 1, Math.floor((lat - minLat) / cellH));
    grid[row][col] = 1;

    // Also fill nearby cells (morphological dilation) for smoother boundary
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          grid[nr][nc] = 1;
        }
      }
    }
  }

  // Additional dilation pass for smoother shape
  const grid2 = Array.from({ length: GRID_SIZE }, (_, r) => new Uint8Array(grid[r]));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 1) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
              grid2[nr][nc] = 1;
            }
          }
        }
      }
    }
  }

  // March along the boundary using marching squares
  const boundaryPoints = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid2[r][c] !== 1) continue;
      // Check if this is a boundary cell (has at least one empty neighbor)
      let isBoundary = false;
      for (let dr = -1; dr <= 1 && !isBoundary; dr++) {
        for (let dc = -1; dc <= 1 && !isBoundary; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || grid2[nr][nc] === 0) {
            isBoundary = true;
          }
        }
      }
      if (isBoundary) {
        const lon = minLon + (c + 0.5) * cellW;
        const lat = minLat + (r + 0.5) * cellH;
        boundaryPoints.push([lon, lat]);
      }
    }
  }

  if (boundaryPoints.length < 3) return null;

  // Order boundary points by angle from centroid
  let cx = 0, cy = 0;
  for (const [lon, lat] of boundaryPoints) { cx += lon; cy += lat; }
  cx /= boundaryPoints.length;
  cy /= boundaryPoints.length;

  boundaryPoints.sort((a, b) => {
    const angleA = Math.atan2(a[1] - cy, a[0] - cx);
    const angleB = Math.atan2(b[1] - cy, b[0] - cx);
    return angleA - angleB;
  });

  // Smooth the boundary with a moving average
  const smoothed = [];
  const W = 3;
  const n = boundaryPoints.length;
  for (let i = 0; i < n; i++) {
    let slon = 0, slat = 0, cnt = 0;
    for (let j = -W; j <= W; j++) {
      const idx = ((i + j) % n + n) % n;
      slon += boundaryPoints[idx][0];
      slat += boundaryPoints[idx][1];
      cnt++;
    }
    smoothed.push([
      Math.round((slon / cnt) * 100000) / 100000,
      Math.round((slat / cnt) * 100000) / 100000,
    ]);
  }

  // Close the ring
  smoothed.push(smoothed[0]);
  return smoothed;
}

function buildIsochrones(nodes, adjacency, profile) {
  console.log(`  [isochrones] Finding nearest node for ${profile}...`);
  const startNode = findNearestNode(nodes, CENTER.lat, CENTER.lng);
  if (!startNode) throw new Error(`No start node found for ${profile}`);

  const startCoord = nodes.get(startNode);
  console.log(`  [isochrones] Start node ${startNode} at ${startCoord.lat},${startCoord.lon}`);

  console.log(`  [isochrones] Running Dijkstra for ${profile} (max ${CONTOURS[CONTOURS.length - 1]} min)...`);
  const reachable = dijkstra(adjacency, startNode, CONTOURS[CONTOURS.length - 1]);
  console.log(`  [isochrones] Reachable nodes: ${reachable.size}`);

  const features = [];
  for (const contour of CONTOURS) {
    console.log(`  [isochrones] Computing ${contour}-min ${profile} contour...`);
    const ring = computeAlphaContour(nodes, reachable, contour);
    if (!ring) {
      console.log(`  [isochrones] WARNING: Could not compute ${contour}-min contour (too few points)`);
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        profile,
        contour,
        contour_minutes: contour,
        source: "overpass-dijkstra",
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    });
    console.log(`  [isochrones] ${contour}-min ${profile}: ${ring.length} boundary points`);
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export default async function prepareIsochrones() {
  const overpassData = await fetchRoadNetwork();

  // Build graphs for both profiles
  console.log("  [isochrones] Building driving graph...");
  const drivingGraph = buildGraph(overpassData, "driving");
  console.log(`  [isochrones] Driving graph: ${drivingGraph.nodes.size} nodes, ${[...drivingGraph.adjacency.values()].reduce((s, a) => s + a.length, 0)} edges`);

  console.log("  [isochrones] Building walking graph...");
  const walkingGraph = buildGraph(overpassData, "walking");
  console.log(`  [isochrones] Walking graph: ${walkingGraph.nodes.size} nodes, ${[...walkingGraph.adjacency.values()].reduce((s, a) => s + a.length, 0)} edges`);

  const drivingIso = buildIsochrones(drivingGraph.nodes, drivingGraph.adjacency, "driving");
  const walkingIso = buildIsochrones(walkingGraph.nodes, walkingGraph.adjacency, "walking");

  const output = {
    driving: drivingIso,
    walking: walkingIso,
  };

  writeFileSync(resolve(OUT, "isochrones.json"), JSON.stringify(output));
  const sizeKb = (JSON.stringify(output).length / 1024).toFixed(1);
  console.log(`  [isochrones] Wrote isochrones.json (${drivingIso.features.length + walkingIso.features.length} contours, ${sizeKb} KB)`);
}

if (process.argv[1] && process.argv[1].endsWith("prepare-isochrones.mjs")) {
  prepareIsochrones().catch(console.error);
}
