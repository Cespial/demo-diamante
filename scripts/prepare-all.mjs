#!/usr/bin/env node
/**
 * prepare-all.mjs
 * Orchestrates all data preparation scripts in parallel.
 * Logs timing for each pipeline.
 */
import prepareTraffic from "./prepare-traffic.mjs";
import prepareParking from "./prepare-parking.mjs";
import prepareCommerce from "./prepare-commerce.mjs";
import prepareUrban from "./prepare-urban.mjs";
import prepareEvents from "./prepare-events.mjs";
import prepareIsochrones from "./prepare-isochrones.mjs";
import prepareMetro from "./prepare-metro.mjs";
import prepareIncidents from "./prepare-incidents.mjs";
import prepareBoundaries from "./prepare-boundaries.mjs";
import preparePedestrian from "./prepare-pedestrian.mjs";
import prepareMacro from "./prepare-macro.mjs";

const pipelines = [
  { name: "traffic", fn: prepareTraffic },
  { name: "parking", fn: prepareParking },
  { name: "commerce", fn: prepareCommerce },
  { name: "urban", fn: prepareUrban },
  { name: "events", fn: prepareEvents },
  { name: "isochrones", fn: prepareIsochrones },
  { name: "metro", fn: prepareMetro },
  { name: "incidents", fn: prepareIncidents },
  { name: "boundaries", fn: prepareBoundaries },
  { name: "pedestrian", fn: preparePedestrian },
  { name: "macro", fn: prepareMacro },
];

async function main() {
  console.log("=== Demo Diamante — Data Pipeline ===");
  console.log(`Started at ${new Date().toISOString()}\n`);

  const globalStart = Date.now();

  const results = await Promise.allSettled(
    pipelines.map(async ({ name, fn }) => {
      const start = Date.now();
      try {
        await fn();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        return { name, status: "ok", elapsed };
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.error(`  [${name}] ERROR: ${err.message}`);
        return { name, status: "error", elapsed, error: err.message };
      }
    })
  );

  console.log("\n=== Pipeline Summary ===");
  for (const r of results) {
    const val = r.value || r.reason;
    const icon = val.status === "ok" ? "OK" : "FAIL";
    console.log(`  ${icon}  ${val.name.padEnd(14)} ${val.elapsed}s${val.error ? ` — ${val.error}` : ""}`);
  }

  const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(2);
  const okCount = results.filter((r) => r.value?.status === "ok").length;
  const failCount = results.length - okCount;
  console.log(`\nCompleted: ${okCount}/${results.length} pipelines (${failCount} failed) in ${totalElapsed}s`);

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
