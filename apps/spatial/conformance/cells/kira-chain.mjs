// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 conformance cell E3 — KIRA FORGETTING / CHAIN-INTEGRITY STRESS (K3 priority 3, issue #15).
 *
 * Reconstructed from canonical public interfaces — imports the REAL brain memory store (@aukora/brain
 * ReactiveMemoryStore) and its content-free receipt chain, driven by a seeded stress load. No /mnt code,
 * fixtures, or logs; every record is generated deterministically from the seed.
 *
 * Falsifiable claims under test:
 *   1. GROWTH — across N seeded ingests, live memory count rises monotonically and the chain grows in step.
 *   2. CHAIN INTEGRITY — verifyChain() holds after every op; the Merkle root + head hash recompute reactively.
 *   3. GOVERNED FORGETTING — an owner-authorized forget DELETES the plaintext (plaintextRetained → false),
 *      makes the record un-recallable, yet APPENDS a content-free tombstone so the chain still verifies
 *      (audit-of-existence preserved; chain never rewritten).
 *   4. NO RESURRECTION — re-ingesting a governedly-forgotten content id is refused (erased plaintext stays gone).
 *   5. FORGET REQUIRES OWNER — forgetting with a failing owner check is refused; the plaintext survives.
 *   6. SECRET FAIL-CLOSED — a record whose content carries a live secret is refused; nothing enters the chain.
 *   7. TAMPER DETECTED — mutating any committed chain link makes verifyChain() fail (fail-closed), and a
 *      corrupt store refuses further ingest.
 */
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import { seededRng } from '../lib/prng.mjs';

export const CELL = 'e3-kira-chain';
const NOW_ISO = '2026-07-16T12:00:00.000Z';

const WORDS = ['covenant', 'dawn', 'anchor', 'lattice', 'ember', 'tide', 'glyph', 'meridian', 'quorum', 'threshold', 'cipher', 'aurora'];
const phrase = (rng) => Array.from({ length: rng.int(3, 7) }, () => rng.pick(WORDS)).join(' ') + ' ' + rng.token(6);

export async function run({ seed = 0xc41a, records = 500, forgets = 60 } = {}) {
  const rng = seededRng(seed >>> 0);
  const store = new ReactiveMemoryStore();

  let growthViolations = 0, integrityViolations = 0;
  let prevLive = 0, prevChain = 0;
  const ingestedIds = [];

  // Phase 1: stress ingest — growth + integrity after every op.
  for (let i = 0; i < records; i++) {
    const rec = buildMemoryRecord({ content: phrase(rng), createdAt: NOW_ISO, kind: 'observation' });
    const v = store.ingest(rec);
    if (!v.ok) {
      // A collision on an identical seeded phrase is legitimate (content-addressed id already live); skip it.
      continue;
    }
    ingestedIds.push(v.recordId);
    const snap = v.snapshot;
    if (snap.liveCount <= prevLive || snap.chainLength <= prevChain) growthViolations++;
    if (!store.verifyChain().valid) integrityViolations++;
    prevLive = snap.liveCount;
    prevChain = snap.chainLength;
  }

  // Phase 2: governed forgetting — plaintext deleted, tombstone appended, chain still verifies.
  const okOwner = () => true;
  const uniqueIds = [...new Set(ingestedIds)];
  let forgetPlaintextGone = 0, forgetUnrecallable = 0, forgetChainStillValid = 0, forgetTombstoned = 0;
  let noResurrection = 0, forgetRequiresOwner = 0;
  const toForget = uniqueIds.slice(0, Math.min(forgets, uniqueIds.length));

  for (const id of toForget) {
    const chainBefore = store.snapshot().chainLength;
    // 5. forgetting with a FAILING owner check is refused; plaintext survives.
    const refusedForget = store.forget(id, () => false, NOW_ISO);
    if (!refusedForget.ok && store.plaintextRetained(id)) forgetRequiresOwner++;
    // 3. governed forget with a valid owner check.
    const f = store.forget(id, okOwner, NOW_ISO);
    if (f.ok && !store.plaintextRetained(id)) forgetPlaintextGone++;
    if (store.recall({ text: id }).every((h) => h.recordId !== id)) forgetUnrecallable++;
    if (store.verifyChain().valid) forgetChainStillValid++;
    if (store.snapshot().chainLength === chainBefore + 1) forgetTombstoned++; // content-free tombstone appended
  }

  // 4. NO RESURRECTION probe: ingest a known record, forget it, re-ingest the identical content → refused.
  const knownContent = 'no-resurrection probe ' + rng.token(8);
  const known = buildMemoryRecord({ content: knownContent, createdAt: NOW_ISO });
  const ki = store.ingest(known);
  if (ki.ok) {
    store.forget(ki.recordId, okOwner, NOW_ISO);
    const readmit = store.ingest(buildMemoryRecord({ content: knownContent, createdAt: NOW_ISO }));
    if (!readmit.ok) noResurrection = 1;
  }

  // 6. SECRET FAIL-CLOSED: a record whose content carries a live secret is refused.
  const secretLike = 'here is a token ghp_' + 'A'.repeat(36); // canonical GitHub PAT shape (synthetic)
  const beforeSecret = store.snapshot().chainLength;
  const sv = store.ingest(buildMemoryRecord({ content: secretLike, createdAt: NOW_ISO }));
  const secretFailClosed = !sv.ok && store.snapshot().chainLength === beforeSecret;

  // 7. TAMPER DETECTED: mutate a committed chain link → verifyChain fails, and further ingest is refused.
  const chainValidBeforeTamper = store.verifyChain().valid;
  const chain = store.chain();
  let tamperDetected = false, corruptStoreRefusesIngest = false;
  if (chain.length > 2) {
    const victim = chain[1]; // a real committed link
    const savedHash = victim.chainHash;
    // in-place tamper of the committed hash (simulates on-disk / in-memory corruption)
    victim.chainHash = victim.chainHash.slice(0, -2) + (victim.chainHash.endsWith('00') ? 'ff' : '00');
    tamperDetected = store.verifyChain().valid === false;
    const afterTamper = store.ingest(buildMemoryRecord({ content: 'post-tamper ' + rng.token(6), createdAt: NOW_ISO }));
    corruptStoreRefusesIngest = afterTamper.ok === false;
    victim.chainHash = savedHash; // restore so the store is left consistent
  }

  const verdict = {
    growthMonotonic: growthViolations === 0 && uniqueIds.length > 0,
    integrityAfterEveryOp: integrityViolations === 0,
    forgetDeletesPlaintext: forgetPlaintextGone === toForget.length && toForget.length > 0,
    forgetUnrecallable: forgetUnrecallable === toForget.length,
    forgetKeepsChainValid: forgetChainStillValid === toForget.length,
    forgetAppendsTombstone: forgetTombstoned === toForget.length,
    forgetRequiresOwner: forgetRequiresOwner === toForget.length,
    noResurrection: noResurrection === 1,
    secretFailClosed,
    tamperDetected: chainValidBeforeTamper && tamperDetected,
    corruptStoreRefusesIngest,
  };
  verdict.pass = Object.values(verdict).every(Boolean);

  const finalSnap = store.snapshot();
  const core = {
    schema: 'aukora-conformance-core-v1',
    cell: CELL,
    title: 'KIRA content-free chain: growth, governed forgetting, no-resurrection, tamper detection',
    seed: seed >>> 0, records, forgets: toForget.length,
    interfaces: ['@aukora/brain:ReactiveMemoryStore', '@aukora/memory:buildMemoryRecord'],
    counters: {
      uniqueIngested: uniqueIds.length, growthViolations, integrityViolations,
      forgetPlaintextGone, forgetUnrecallable, forgetChainStillValid, forgetTombstoned, forgetRequiresOwner,
    },
    finalSnapshot: { liveCount: finalSnap.liveCount, chainLength: finalSnap.chainLength, forgottenCount: finalSnap.forgottenCount, headHash: finalSnap.headHash, merkleRootHex: finalSnap.merkleRootHex },
    verdict,
  };
  return { core, verdict };
}
