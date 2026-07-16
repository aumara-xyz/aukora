import { defineConfig } from "vitest/config";
// Assertion tests only. The fixture GENERATOR lives under tooling/ and is run separately
// (`npm run fixture` → vitest.gen.config.ts) so a plain `npm test` never rewrites the committed fixture.
export default defineConfig({ test: { environment: "node", include: ["test/**/*.test.{ts,js}"] } });
