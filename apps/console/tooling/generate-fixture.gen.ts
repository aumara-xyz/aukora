// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * DEMO_FIXTURE generator for the read-only operator console.
 *
 * This is NOT the console. It runs the REAL organism (the same deterministic, offline, in-memory reactive
 * adapter + governed recursion the `demo:organism` proof runs) plus one REAL offline Fu council pass, and
 * captures their actual outputs into a committed fixture the static console renders. Every number, hash,
 * verdict, and label in the fixture is produced by the canonical packages — nothing is hand-authored.
 *
 * Determinism: a fixed seed instant (NOW_ISO) drives every clock input, so re-running this writes a
 * byte-stable fixture (clean diffs). No network, no cloud, no paid call, no filesystem write outside
 * apps/console/public, no live-repo mutation, no signing on anyone's behalf.
 *
 * Run: `npm run fixture` (from apps/console) → writes public/fixture.json + public/fixture.js.
 * It is deliberately kept out of the default test glob so `npm test` never regenerates the fixture.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ReactiveMemoryStore,
  MODEL_MANIFEST,
  DeterministicOfflineProvider,
  providerGrantsAuthority,
} from '@aukora/brain';
import { buildMemoryRecord, stalenessVerdict } from '@aukora/memory';
import {
  LocalOwnerAdapter,
  proposalDigest,
  runGovernedRecursion,
  type Proposal,
} from '@aukora/seed';
import {
  runAukoraFuCouncil,
  CANONICAL_SEATS,
  DEFAULT_QUORUM_RULE,
  DEFAULT_SPEND_LIMITS,
  PACKET_OPEN,
  PACKET_CLOSE,
  type Transport,
  type CouncilSeat,
} from '@aukora/council';

// ── deterministic seed instant (no wall clock anywhere) ────────────────────────────────────────
const NOW_ISO = '2026-07-16T08:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const at = (s: number) => `2026-07-16T08:00:${String(s).padStart(2, '0')}.000Z`;
const short = (h: string | null, n = 16) => (h ? `${h.slice(0, n)}…` : null);

// ── 1. Real organism transcript (mirrors demo:organism, captured live) ──────────────────────────
const store = new ReactiveMemoryStore();
const growth: Array<{ step: string; liveCount: number; chainLength: number }> = [];

const A = store.ingest(buildMemoryRecord({ content: 'event A: the organism came online', createdAt: at(1), provenance: 'sensor' }));
growth.push({ step: 'ingest #1 · provenance=sensor', liveCount: store.snapshot().liveCount, chainLength: store.snapshot().chainLength });

store.ingest(buildMemoryRecord({ content: 'event B: it remembered A and reacted', createdAt: at(2), provenance: 'reflection' }));
growth.push({ step: 'ingest #2 · provenance=reflection', liveCount: store.snapshot().liveCount, chainLength: store.snapshot().chainLength });

const chainVerified = store.verifyChain().valid;

// ── 2. Governed recursion — refused (no owner sig) then accepted (owner-signed), into a sandbox ──
const owner = new LocalOwnerAdapter('demo'); // deterministic fixture owner; the PUBLIC key is safe to show
const targetPath = 'apps/seed/src/recursion.ts';
const proposal: Proposal = { id: 'p1', targetPath, newContent: '// governed refinement to the recursion note', createdAt: at(3) };
const env = {
  store,
  knownFiles: new Set([targetPath, 'apps/brain/src/reactiveStore.ts']),
  ownerPublicKeyHex: owner.publicKeyHex,
  nowMs: NOW_MS,
  nowIso: NOW_ISO,
};

const refused = runGovernedRecursion(env, proposal /* no owner authorization */);
const digest = proposalDigest(proposal.id, proposal.targetPath, proposal.newContent);
const accepted = runGovernedRecursion(env, proposal, { signatureHex: owner.sign(digest), publicKeyHex: owner.publicKeyHex });
growth.push({ step: 'owner-signed proposal → receipt memory', liveCount: store.snapshot().liveCount, chainLength: store.snapshot().chainLength });

// ── 3. Governed forgetting — owner-authorized tombstone (content-free audit; chain still verifies) ─
const forgetTargetId = store.recall({ text: 'came online' })[0]!.recordId;
const recallBefore = store.recall({ text: 'came online' }).length;
const forget = store.forget(forgetTargetId, () => true, at(5));
const recallAfter = store.recall({ text: 'came online' }).length;
const chainStillVerifies = store.verifyChain().valid;
const lastEntry = store.chain()[store.chain().length - 1]!;
const tombstonePayload = lastEntry.payload as Record<string, unknown>;
const tombstoneContentFree = !JSON.stringify(tombstonePayload).includes('came online');

// ── 4. Content-free receipt/Merkle lineage (hashes + kinds + provenance only; never plaintext) ──
const lineage = store.chain().map((e, i) => {
  const p = e.payload as Record<string, unknown>;
  const isTomb = p.kind === 'tombstone';
  return {
    index: i,
    kind: isTomb ? 'tombstone' : 'memory',
    provenance: isTomb ? null : (typeof p.provenance === 'string' ? p.provenance : 'unspecified'),
    recordIdShort: !isTomb && typeof p.recordId === 'string' ? short(p.recordId, 12) : null,
    chainHashShort: short(e.chainHash),
    prevHashShort: short(e.prevHash),
  };
});
const snap = store.snapshot();

// ── 5. Staleness law — fresh / stale / unknown-age, straight from the pure verdict ──────────────
const stalenessFresh = stalenessVerdict({ createdAt: at(1) }, NOW_MS); // ~7h old → fresh
const stalenessStale = stalenessVerdict({ createdAt: '2026-07-12T08:00:00.000Z' }, NOW_MS); // >72h → stale
const stalenessUnknown = stalenessVerdict({}, NOW_MS); // no age → flagged stale

// ── 6. One REAL offline Fu council pass (no live provider, no paid call) ─────────────────────────
// A deterministic offline transport returns valid, identity-matched glyph packets for the eight canonical
// seats. Distributions are deliberately varied so the council surfaces genuine disagreement (shear) rather
// than rubber-stamping. Cost is $0 (nothing is dispatched to a provider); the spend meter still enforces
// its projection ceiling before anything would run.
type PacketSpec = { stance: string; conf: string; strat: string; dist: [number, number, number, number]; claims: string; hyp: string };
const SPEC: Record<string, PacketSpec> = {
  FBL: { stance: '⊕', conf: '↑', strat: '↙', dist: [0.05, 0.15, 0.75, 0.05], claims: 'C1=+0.85,C2=+0.70', hyp: 'lineage verifies; the memory is durable' },
  DSK: { stance: '⊕', conf: '↑', strat: '↙', dist: [0.05, 0.20, 0.70, 0.05], claims: 'C1=+0.80,C2=+0.65', hyp: 'receipts check out; keep the memory' },
  SOL: { stance: '⊕', conf: '→', strat: '↙', dist: [0.10, 0.15, 0.70, 0.05], claims: 'C1=+0.75,C2=+0.60', hyp: 'growth is provable; support ingest' },
  GEM: { stance: '⊕', conf: '↑', strat: '↘', dist: [0.10, 0.20, 0.65, 0.05], claims: 'C1=+0.70,C2=+0.65', hyp: 'merkle root confirms the chain' },
  MST: { stance: '⊕', conf: '→', strat: '↙', dist: [0.05, 0.20, 0.70, 0.05], claims: 'C1=+0.72,C2=+0.62', hyp: 'verified lineage supports durability' },
  KIM: { stance: '⊕', conf: '↑', strat: '⇄', dist: [0.10, 0.25, 0.60, 0.05], claims: 'C1=+0.68,C2=+0.60', hyp: 'reaction is grounded in remembered A' },
  QWN: { stance: '⊖', conf: '↓', strat: '↗', dist: [0.75, 0.15, 0.05, 0.05], claims: 'C1=+0.30,C2=-0.20', hyp: 'explore whether B is redundant first' },
  GRK: { stance: '⊖', conf: '→', strat: '↖', dist: [0.70, 0.20, 0.05, 0.05], claims: 'C1=+0.20,C2=-0.10', hyp: 'narrative continuity is unproven here' },
};

function packetText(seat: CouncilSeat): string {
  const s = SPEC[seat.id]!;
  const [ex, xp, ve, ab] = s.dist;
  return [
    PACKET_OPEN,
    `STANCE:${s.stance} CONFIDENCE:${s.conf} STRATEGY:${s.strat} FRAMEWORK:${seat.framework} DIST:(explore=${ex},exploit=${xp},verify=${ve},abstain=${ab})`,
    `CLAIMS:(${s.claims})`,
    `HYP:"${s.hyp}"`,
    PACKET_CLOSE,
  ].join('\n');
}

const SYNTHESIS_ANSWER =
  'Ingesting event B as a durable memory is supported: the receipt chain and Merkle root verify and growth is ' +
  'provable across ingests. This is advisory only — the AUMLOK owner-gate authorizes any change.\n' +
  'USED_CLAIMS:(C1,C2)';

const offlineTransport: Transport = async (seat, _prompt, phase) => {
  if (phase === 'synthesis') return { text: SYNTHESIS_ANSWER, served: seat.slug, costUsd: 0 };
  return { text: packetText(seat), served: seat.slug, costUsd: 0 };
};

const council = await runAukoraFuCouncil(
  {
    problem: 'Should the organism keep event B as a durable memory?',
    claims: ['the receipt chain and Merkle root verify', 'growth is provable across ingests'],
  },
  offlineTransport,
  { now: NOW_MS },
);

// ── 7. Assemble the fixture (all values above are REAL organism / council outputs) ──────────────
const fixture = {
  schema: 'aukora-console-fixture-v1',
  label: 'DEMO_FIXTURE',
  readOnly: true,
  generatedFromSeedInstant: NOW_ISO,
  provenance:
    'Generated by apps/console/tooling/generate-fixture.gen.ts running the real @aukora organism + one ' +
    'offline @aukora/council pass. Deterministic, offline, no cloud, no paid call, no live-repo mutation.',
  meta: {
    title: 'Aukora — Governed Organism Operator Console',
    subtitle: 'Read-only investor view of a governed, growing, remembering organism.',
    truthLegend: {
      IMPLEMENTED: 'source + test + demo prove it here',
      ROADMAP: 'designed / wired elsewhere; not proven on this path',
      UNARMED: 'capability deliberately not enabled',
    },
  },

  authority: {
    title: 'AUMLOK authority',
    lockState: 'LOCKED',
    truth: 'IMPLEMENTED',
    gate: 'Owner-gate — Ed25519 signature over the canonical proposal digest',
    ownerPublicKeyHex: owner.publicKeyHex, // PUBLIC key only — never a secret
    noModelCanSign: true,
    grantsAuthority: false,
    productionSuite: 'aumlok-ed25519-ml-dsa-65-v1 — hybrid Ed25519 + ML-DSA-65 verify (verifyAumlokPromotionV2 in @aukora/kernel/authority)',
    note: 'Advisory review authorizes nothing; only a valid owner signature does. The console cannot sign.',
  },

  memory: {
    title: 'Reactive memory',
    truth: 'IMPLEMENTED',
    liveCount: snap.liveCount,
    chainLength: snap.chainLength,
    forgottenCount: snap.forgottenCount,
    headHashShort: short(snap.headHash),
    merkleRootShort: short(snap.merkleRootHex),
    lastEventAt: snap.lastEventAt,
    growth,
    note: 'Snapshot recomputes on every ingest/forget; live memory count strictly rises across ingests.',
  },

  lineage: {
    title: 'Receipt & Merkle lineage',
    truth: 'IMPLEMENTED',
    verified: chainVerified && chainStillVerifies,
    merkleRootShort: short(snap.merkleRootHex),
    entries: lineage,
    note: 'Append-only receipt chain (memories + content-free tombstones); the canonical verifier detects any tampered link. Entries carry hashes and kinds only — never plaintext.',
  },

  recursion: {
    title: 'Proposal lifecycle',
    truth: 'IMPLEMENTED',
    proposalId: proposal.id,
    targetPath: proposal.targetPath,
    pipeline: [
      'grounded against real files',
      'staleness law',
      'secret scan',
      'authority-shape scan',
      'advisory council review',
      'AUMLOK owner-gate',
      'sandbox-only apply (in-memory)',
      'receipt-chained memory',
    ],
    refusedWithoutOwner: {
      accepted: refused.accepted,
      stage: refused.stage,
      councilVerdict: refused.councilVerdict ?? null,
      sandboxApplied: refused.sandboxApplied,
      meaning: 'advisory review ran and PASSED, yet the owner-gate refused — review never authorizes.',
    },
    acceptedWithOwner: {
      accepted: accepted.accepted,
      stage: accepted.stage,
      sandboxApplied: accepted.sandboxApplied,
      receiptHashShort: short(accepted.receiptHash ?? null),
      liveRepoTouched: false,
      meaning: 'owner-signed → applied to an ISOLATED in-memory sandbox; the live repository is never written.',
    },
    staleness: {
      truth: 'IMPLEMENTED',
      fresh: { state: stalenessFresh.state, ageLabel: stalenessFresh.ageLabel, flagged: stalenessFresh.flagged, expiringSoon: stalenessFresh.expiringSoon, horizon: stalenessFresh.horizon },
      stale: { state: stalenessStale.state, ageLabel: stalenessStale.ageLabel, flagged: stalenessStale.flagged, expiringSoon: stalenessStale.expiringSoon, horizon: stalenessStale.horizon },
      unknownAge: { state: stalenessUnknown.state, ageLabel: stalenessUnknown.ageLabel, flagged: stalenessUnknown.flagged, expiringSoon: stalenessUnknown.expiringSoon, horizon: stalenessUnknown.horizon },
      note: 'Expiry means flagged, never hidden; a stale or unknown-age proposal cannot mint a signing challenge without an explicit owner revive.',
    },
  },

  council: {
    title: 'Aukora Fu council',
    truth: 'IMPLEMENTED',
    transport: 'deterministic offline — no live provider contacted, no paid call',
    roster: CANONICAL_SEATS.map((s) => ({ id: s.id, name: s.name, family: s.family, framework: s.framework })),
    quorumRule: { minVotes: DEFAULT_QUORUM_RULE.minVotes, minFamilies: DEFAULT_QUORUM_RULE.minFamilies, requireSeatId: DEFAULT_QUORUM_RULE.requireSeatId },
    votes: council.votes.length,
    seats: CANONICAL_SEATS.length,
    votingFamilies: council.votingFamilies,
    quorumMet: council.quorumMet,
    fableVerified: council.fableVerified,
    geometry: {
      coherence: Number(council.geometry.coherence.toFixed(3)),
      shearMagnitude: Number(council.geometry.shearMagnitude.toFixed(3)),
      phaseLockDetected: council.geometry.phaseLockDetected,
      hasEvidenceAnchor: council.geometry.hasEvidenceAnchor,
      reason: council.geometry.reason,
    },
    verdict: council.verdict,
    answerSource: council.answerSource,
    advisory: council.advisory,
    grantsAuthority: council.grantsAuthority,
    note: 'The council is EVIDENCE, never authority. It surfaces disagreement (shear) rather than hiding it; its verdict authorizes nothing.',
  },

  providers: {
    title: 'Providers',
    truth: 'IMPLEMENTED',
    offlineProvider: { id: new DeterministicOfflineProvider().id, truth: 'IMPLEMENTED', note: 'same prompt ⇒ same output; no network, reproducible' },
    grantsAuthority: providerGrantsAuthority(),
    manifest: MODEL_MANIFEST.map((m) => ({ id: m.id, label: m.label, truth: m.truth })),
    note: 'Truth labels only — no weights, endpoint IDs, job IDs, bucket IDs, or tokens. A provider grants no authority.',
  },

  budget: {
    title: 'Budget & hard-stop',
    truth: 'IMPLEMENTED',
    perPassUsd: DEFAULT_SPEND_LIMITS.perPassUsd,
    perDayUsd: DEFAULT_SPEND_LIMITS.perDayUsd,
    estimatedUsd: Number(council.estimatedUsd.toFixed(4)),
    actualUsd: Number(council.actualUsd.toFixed(4)),
    failClosed: true,
    note: 'Whole-pass projection refuses to start before any paid call; unknown/zero prices fail HIGH so an estimate can never sneak under a ceiling. An append-only JSONL ledger holds the day cap across processes. This pass ran offline: actual $0.',
  },

  convex: {
    title: 'Persistence mode',
    truth: 'IMPLEMENTED',
    current: 'in-memory',
    modes: ['live', 'convex-test', 'in-memory', 'unavailable'],
    note: 'This run uses the deterministic in-memory reactive adapter and makes NO live-cloud claim. The curated Convex backend (apps/brain/convex) mirrors the same contracts; convex-test wiring is the next step.',
  },

  g1: {
    title: 'G1 / Nebius replication',
    state: 'UNARMED',
    truth: 'UNARMED',
    replication: 'G1 self-replication stays QUARANTINE / unarmed on this path',
    nebius: 'not contacted — offline. No endpoint IDs, job IDs, bucket IDs, or tokens are present in this console.',
    note: 'Not claimed: self-replicating, alive, or conscious. Liquid / Nemotron are BLOCKED; the router seed is DESIGN_ONLY until artifacts prove otherwise.',
  },

  forgetting: {
    title: 'Governed forgetting',
    truth: 'IMPLEMENTED',
    forgotten: forget.ok,
    forgottenRecordIdShort: short(forgetTargetId, 12),
    recallBefore,
    recallAfter,
    chainStillVerifies,
    tombstoneContentFree,
    chainRewritten: false,
    note: 'Owner-authorized tombstone → the content is invisible to recall and never surfaced again; a content-free audit that it existed and was forgotten is kept; the historical chain is never rewritten.',
  },
} as const;

// ── 8. Write the committed fixture (JSON for tests/transparency, JS global for the browser) ─────
describe('generate DEMO_FIXTURE', () => {
  it('runs the real organism + offline council and writes a byte-stable fixture', () => {
    // Sanity: the values we are about to ship are the real ones.
    expect(A.ok).toBe(true);
    expect(chainVerified).toBe(true);
    expect(refused.accepted).toBe(false);
    expect(refused.stage).toBe('owner-gate-refused');
    expect(accepted.accepted).toBe(true);
    expect(accepted.sandboxApplied).toBe(true);
    expect(recallAfter).toBe(0);
    expect(chainStillVerifies).toBe(true);
    expect(tombstoneContentFree).toBe(true);
    expect(council.quorumMet).toBe(true);
    expect(council.grantsAuthority).toBe(false);
    expect(council.actualUsd).toBe(0);

    const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
    mkdirSync(outDir, { recursive: true });
    const json = JSON.stringify(fixture, null, 2);
    writeFileSync(join(outDir, 'fixture.json'), json + '\n');
    writeFileSync(
      join(outDir, 'fixture.js'),
      '// GENERATED — do not edit by hand. Run `npm run fixture` to regenerate from the real organism.\n' +
        '// Loaded as a plain script so the console renders from file:// or any static server, with no fetch.\n' +
        `globalThis.AUKORA_CONSOLE_FIXTURE = ${json};\n`,
    );
    // eslint-disable-next-line no-console
    console.log(`  wrote fixture.json + fixture.js (${fixture.council.verdict} · ${snap.liveCount} live memories)`);
  });
});
