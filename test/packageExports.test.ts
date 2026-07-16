// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aumara
//
// Proves the public package surfaces resolve through their package.json `exports` (via the
// workspace symlink), independent of relative paths — i.e. a consumer that writes
// `import { textHasSecret } from '@aukora/evidence'` gets the real canonical primitive.
// This is repo-level coverage; it borrows nothing from any application suite.
import { describe, it, expect } from "vitest";
import * as evidence from "@aukora/evidence";
import * as council from "@aukora/council";
import * as councilNode from "@aukora/council-node";

describe("@aukora/evidence public export", () => {
  it("exposes the canonical EvidencePack + secret-projection primitives", () => {
    expect(typeof evidence.canonicalString).toBe("function");
    expect(typeof evidence.packDigest).toBe("function");
    expect(typeof evidence.validatePackBody).toBe("function");
    expect(typeof evidence.textHasSecret).toBe("function");
    expect(typeof evidence.verifyEnvelope).toBe("function");
  });
});

describe("@aukora/council public export", () => {
  it("exposes the advisory council core and its glyph channel", () => {
    expect(Array.isArray(council.CANONICAL_SEATS)).toBe(true);
    expect(council.CANONICAL_SEATS.length).toBeGreaterThanOrEqual(8);
    expect(typeof council.GlyphChannel).toBe("function");
    expect(typeof council.perceive).toBe("function");
    expect(typeof council.freezeClaimBasis).toBe("function");
  });
  it("carries no filesystem ledger (that lives only in @aukora/council-node)", () => {
    expect((council as Record<string, unknown>).AukoraFuSpendLedger).toBeUndefined();
  });
});

describe("@aukora/council-node public export", () => {
  it("exposes only the Node fs spend-ledger adapter", () => {
    expect(typeof councilNode.AukoraFuSpendLedger).toBe("function");
    expect(typeof councilNode.utcDay).toBe("function");
  });
});
