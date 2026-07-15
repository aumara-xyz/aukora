// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aumara
//
// Provenance guard. This repository has a FRESH root history — no donor commits are imported.
// Instead, the canonical primitive sources were copied byte-identical from the frozen donor
// `aukora-kernel` and their provenance is pinned here by the donor git-blob object hash.
//
// The blob hash below is exactly `git hash-object <file>` (sha1 of "blob <len>\0<bytes>"), so a
// byte-identical copy reproduces the donor's blob id. Any drift from the donor bytes fails loudly,
// which is what lets us claim "single canonical implementation, provably the reviewed donor code"
// without importing donor history. See docs/PROVENANCE.md for the human-readable record.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");

export const DONOR = {
  repo: "github.com/aumara-xyz/aukora-kernel",
  commit: "b441edc4d17de778d30ae955f46408edae39bffe",
  tree: "711336558a1398edc5706e9dc600e55351c202ee",
  // whole promoted @aukora/kernel package: donor subtree object at packages/kernel
  kernelSubtree: "364d02d3bf452a8d2ee00764a9ef4e02c6eb1bfb",
};

// new-repo path  ->  donor git-blob sha (from aukora-kernel @ DONOR.commit)
const CANONICAL_BLOBS = {
  "packages/evidence/src/canonical.ts": "623b008a3cc2fc5350054e75b4ab4b65cbcfea11",
  "packages/evidence/src/catalogue.ts": "2b7ff7f32f8bf403776b5dba624ba5ee1b7c75b0",
  "packages/evidence/src/digest.ts": "1a07e9d4d2a23c74d9beb438dcd0296feab1016f",
  "packages/evidence/src/framing.ts": "ec698ba0a704d9d69afbe555b635d3905a4601e2",
  "packages/evidence/src/index.ts": "ba1a9e90e7ddc53b6eb9e327fd737fe51efc96b0",
  "packages/evidence/src/types.ts": "d0e2f4d15c54660d8f2006caff3f58621cbf1d92",
  "packages/evidence/src/validate.ts": "2d6a247a602cc86fcba52120052a1a972572f640",
  "packages/council/src/aukoraFuCouncil.ts": "93bc046ab866ad022b82e9dc04aac65eb6ae39dc",
  "packages/council/src/aukoraFuGlyph.ts": "7081ab39890ce654929d326155d77f85bb585a99",
  "packages/council-node/src/aukoraFuSpendLedger.ts": "60d4407cf4ad8056802e3dbb3be7fd88a0ecec60",
};

function gitBlobSha(buf) {
  const h = crypto.createHash("sha1");
  h.update("blob " + buf.length + "\0");
  h.update(buf);
  return h.digest("hex");
}

const problems = [];
for (const [rel, want] of Object.entries(CANONICAL_BLOBS)) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { problems.push(`missing canonical source: ${rel}`); continue; }
  const got = gitBlobSha(fs.readFileSync(abs));
  if (got !== want) problems.push(`DRIFT: ${rel}: blob ${got} != donor ${want}`);
}

if (problems.length) {
  console.error("provenance: FAILED");
  for (const p of problems) console.error(`- ${p}`);
  console.error(`\nThe promoted sources must stay byte-identical to donor ${DONOR.commit.slice(0, 12)}.`);
  console.error(`If a change is intended, it must land in the DONOR first (or a later Symbiote/Fu rebase), not here.`);
  process.exit(1);
}

console.log(
  `provenance: verified (${Object.keys(CANONICAL_BLOBS).length} canonical sources byte-identical to donor ` +
    `aukora-kernel ${DONOR.commit.slice(0, 12)}, tree ${DONOR.tree.slice(0, 12)})`,
);
