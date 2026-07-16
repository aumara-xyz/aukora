import { defineConfig } from "vitest/config";
// Fixture-generation config. Runs the tooling generator which executes the REAL organism + an offline
// Fu council pass and writes the committed DEMO_FIXTURE (public/fixture.js + public/fixture.json).
// Separated from the default config so `npm test` (assertions) never regenerates the fixture.
export default defineConfig({ test: { environment: "node", include: ["tooling/**/*.gen.{ts,js}"] } });
