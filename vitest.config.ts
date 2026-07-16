// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aumara
// Root suite for the source-export packages (evidence, council, council-node) plus the
// repo-level boundary and package-export smoke tests. @aukora/kernel has its own vitest
// config and is exercised by `npm run test:kernel`, so it is intentionally excluded here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/evidence/test/**/*.test.ts",
      "packages/council/test/**/*.test.ts",
      "packages/council-node/test/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    testTimeout: 30_000,
  },
});
