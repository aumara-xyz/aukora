import { defineConfig } from "vitest/config";
// Projection-generation config (R36). Runs the tooling generator which executes the REAL merged-main
// organism (@aukora/brain + @aukora/seed durable recursion) and writes projection/projection.json — the
// live-local payload the launcher serves at /api/spatial/projection. Separated from the default config so
// `npm test` never regenerates the projection it asserts against.
export default defineConfig({ test: { environment: "node", include: ["tooling/**/*.gen.{ts,js}"] } });
