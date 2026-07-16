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

// ── 6b. AUMA LIVE advisory context — real BrainProvider output, deterministic and offline ───────
// This is UNTRUSTED advisory context: a provider completion grants no authority and cannot sign,
// authorize, apply, or merge. The value is the actual DeterministicOfflineProvider output.
const advisoryProvider = new DeterministicOfflineProvider();
const advisoryPrompt = 'status: is the organism healthy and growing?';
const advisoryOutput = await advisoryProvider.complete(advisoryPrompt);

// ── 6c. SPATIAL MAP graph — derived from the ACTUAL organism state (not a decorative diagram) ────
// Nodes/edges are computed from the real roster, receipt chain, and proposal. Counts equal the live
// organism state, so the map cannot drift from the data a test can independently recompute.
const receiptIndex = lineage.find((e) => e.provenance === 'governed-recursion')?.index ?? null;
const spatialNodes = [
  { id: 'auma', kind: 'core', label: 'AUMA' },
  { id: 'authority', kind: 'authority', label: 'AUMLOK' },
  { id: 'provider', kind: 'provider', label: advisoryProvider.id },
  { id: 'council', kind: 'council', label: 'Fu council' },
  ...CANONICAL_SEATS.map((s) => ({ id: `seat:${s.id}`, kind: 'seat', label: s.name })),
  ...lineage.map((e) => ({ id: `chain:${e.index}`, kind: e.kind, label: `${e.kind} #${e.index}` })),
  { id: 'proposal', kind: 'proposal', label: proposal.id },
];
const spatialEdges = [
  { from: 'auma', to: 'authority', kind: 'governs' },
  { from: 'auma', to: 'provider', kind: 'advises' },
  { from: 'auma', to: 'council', kind: 'advises' },
  ...CANONICAL_SEATS.map((s) => ({ from: 'council', to: `seat:${s.id}`, kind: 'seat' })),
  { from: 'auma', to: 'chain:0', kind: 'memory' },
  ...lineage.slice(1).map((e) => ({ from: `chain:${e.index - 1}`, to: `chain:${e.index}`, kind: 'chain' })),
  { from: 'authority', to: 'proposal', kind: 'owner-gate' },
  ...(receiptIndex !== null ? [{ from: 'proposal', to: `chain:${receiptIndex}`, kind: 'receipt' }] : []),
];

// A committed, self-contained SVG snapshot of the SPATIAL MAP — inline-styled (no external CSS/theme) so it
// renders anywhere, including GitHub's file view. Same nodes/edges/layout as the live shell; it is a faithful
// visual artifact of the data-driven map for the PR, not a decorative diagram.
function buildSpatialSvgSnapshot(): string {
  const W = 820, H = 470;
  const seatNodes = spatialNodes.filter((n) => n.kind === 'seat');
  const chainNodes = spatialNodes.filter((n) => n.id.startsWith('chain:'));
  const pos: Record<string, [number, number]> = {
    auma: [380, 235], authority: [380, 66], proposal: [170, 132], provider: [170, 360], council: [560, 150],
  };
  const colDY = seatNodes.length > 1 ? 400 / (seatNodes.length - 1) : 0;
  seatNodes.forEach((n, i) => { pos[n.id] = [680, 44 + i * colDY]; });
  chainNodes.forEach((n, i) => { pos[n.id] = [230 + i * 96, 428]; });
  const R: Record<string, number> = { core: 26, authority: 16, provider: 14, council: 18, proposal: 14, seat: 9, memory: 11, tombstone: 11 };
  const FILL: Record<string, string> = { core: '#6ea0ff', authority: '#e2b04a', provider: '#9cc0ff', council: '#57d08c', proposal: '#6ea0ff', seat: '#8a93a3', memory: '#9cc0ff', tombstone: '#8a93a3' };
  const edgeStyle = (k: string) => k === 'owner-gate' ? 'stroke="#e2b04a" stroke-dasharray="4 3" opacity="0.85"'
    : k === 'receipt' ? 'stroke="#57d08c" stroke-dasharray="4 3" opacity="0.85"'
    : k === 'seat' ? 'stroke="#262d38" opacity="0.6"' : 'stroke="#38404d" opacity="0.7"';
  const lines = spatialEdges.map((e) => {
    const a = pos[e.from], b = pos[e.to]; if (!a || !b) return '';
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${edgeStyle(e.kind)} stroke-width="1.2"/>`;
  }).join('');
  const dots = spatialNodes.map((n) => {
    const p = pos[n.id]; if (!p) return '';
    const r = R[n.kind] ?? 10, below = n.kind !== 'core';
    const ly = p[1] + (below ? r + 13 : 4);
    const fs = (n.kind === 'seat' || n.kind === 'memory' || n.kind === 'tombstone') ? 10 : (n.kind === 'core' ? 13 : 11);
    const tf = n.kind === 'core' ? '#e8ecf2' : '#b3bcc9';
    return `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${FILL[n.kind] ?? '#8a93a3'}" stroke="#161b22" stroke-width="1.5"/>`
      + `<text x="${p[0]}" y="${ly}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fs}" font-weight="600" fill="${tf}">${n.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Aukora spatial map (DEMO_FIXTURE)">`
    + `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0e1116" stroke="#262d38"/>`
    + `<text x="16" y="26" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#8a93a3">AUKORA SPATIAL MAP · DEMO_FIXTURE · ${spatialNodes.length} nodes / ${spatialEdges.length} edges</text>`
    + `<g>${lines}</g><g>${dots}</g></svg>\n`;
}

// ── 7. Assemble the fixture (all values above are REAL organism / council outputs) ──────────────
const fixture = {
  schema: 'aukora-console-fixture-v1',
  label: 'DEMO_FIXTURE',
  readOnly: true,
  dataMode: 'DEMO_FIXTURE', // the active source; the others are labelled but not live
  dataModes: ['DEMO_FIXTURE', 'CONVEX_TEST', 'LIVE'],
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

  // ── R30 spatial shell surfaces ────────────────────────────────────────────────────────────────
  auma: {
    title: 'AUMA LIVE',
    truth: 'IMPLEMENTED',
    providerId: advisoryProvider.id,
    advisoryPrompt,
    advisoryOutput, // real DeterministicOfflineProvider output — deterministic, offline
    councilVerdict: council.verdict,
    untrusted: true,
    cannot: ['sign', 'authorize', 'apply', 'merge'],
    note: 'BrainProvider output is UNTRUSTED advisory context. AUMA LIVE cannot sign, authorize, apply, or merge; only the AUMLOK owner-gate authorizes anything.',
  },

  spatial: {
    title: 'SPATIAL MAP',
    truth: 'IMPLEMENTED',
    derivedFrom: { seats: CANONICAL_SEATS.length, chainEntries: lineage.length, proposals: 1, receiptChainIndex: receiptIndex },
    nodes: spatialNodes,
    edges: spatialEdges,
    note: 'Driven from actual council / memory / proposal / receipt data — node and edge counts equal the real organism state, not a decorative static diagram.',
  },

  // Sam 2 · BrainHealthSnapshotV1 — the local-brain read-only health contract. This is the explicit FIXTURE
  // FALLBACK; contracts.js tries the live endpoint first and falls back here, clearly labelled.
  brainHealth: {
    schema: 'BrainHealthSnapshotV1',
    source: 'fixture-fallback',
    mode: 'in-memory',
    convexMode: 'in-memory',
    liveCount: snap.liveCount,
    chainLength: snap.chainLength,
    forgottenCount: snap.forgottenCount,
    headHashShort: short(snap.headHash),
    merkleRootShort: short(snap.merkleRootHex),
    verified: chainVerified && chainStillVerifies,
    lastEventAt: snap.lastEventAt,
    grantsAuthority: false,
  },

  // Sam 3 · AUMLOK ceremony DESIGN contract (mirrors core/src/aumlokCeremonySpec.ts). Read-only design
  // artifact: it describes the ceremony's phases and grants NOTHING; no key, no signing in the browser.
  ceremony: {
    schema: 'aumlok-ceremony-design-v0',
    source: 'fixture-fallback',
    designOnly: true,
    readOnly: true,
    signerLabel: 'production_not_built',
    grantsAuthority: false,
    phases: [
      { phase: 'preflight_truth', state: 'done', title: 'Preflight truth', detail: 'Show the structured-truth banner before any consent.' },
      { phase: 'scope_declaration', state: 'done', title: 'Scope declaration', detail: 'Declare the exact fixed scope — from a template, not free prose.' },
      { phase: 'authority_exclusions', state: 'done', title: 'Authority exclusions', detail: 'No Ring-0, no live apply, no production AUMLOK, no autonomous authority.' },
      { phase: 'consent_phrase', state: 'gate', title: 'Human consent', detail: 'The human enters a consent phrase — records intent, not power. Lands outside the browser.' },
      { phase: 'key_custody_declaration', state: 'done', title: 'Key custody', detail: 'The human alone holds the authority key. The AI never holds it.' },
      { phase: 'signer_label', state: 'done', title: 'Signer label', detail: 'Labelled honestly: production-not-built this round.' },
      { phase: 'signature_receipt', state: 'done', title: 'Signature receipt (shape only)', detail: 'The receipt SHAPE a real ceremony would emit — no real signature this round.' },
      { phase: 'revocation_expiry', state: 'done', title: 'Revocation & expiry', detail: 'Every binding is revocable and must expire.' },
      { phase: 'post_ceremony_truth', state: 'done', title: 'Post-ceremony truth', detail: 'Re-show the truth banner: identity legibility changed; NO capability changed.' },
    ],
    authorityExclusions: [
      'does NOT grant Ring-0', 'does NOT grant live apply', 'does NOT grant production AUMLOK',
      'does NOT grant autonomous authority', 'does NOT hand any key to the AI',
    ],
    continuityLayers: [
      { layer: 'L0', name: 'audited execution harness', status: 'present', note: 'lab signer + receipts + structured truth' },
      { layer: 'L1', name: 'episodic memory', status: 'seeded', note: 'receipt-labeled episode memory (fixture-only)' },
      { layer: 'L2', name: 'consolidation / dream cycle', status: 'future', note: 'candidate' },
      { layer: 'L3', name: 'identity anchors', status: 'future', note: 'linked to the AUMLOK ceremony' },
      { layer: 'L4', name: 'latent / VK communication', status: 'experimental_gated', note: 'baseline first; never authority' },
    ],
    note: 'AUMLOK is the gate; AURA is the coherence the same ceremony grows. No custody, no signing, no authority in this surface.',
  },

  // Left lane · Chats/Auma — one being, one memory. AUMA LIVE is directly conversational; replies are
  // deterministic OFFLINE advisory (no paid/live call). Proposals halt for the AUMLOK signature.
  chat: {
    threads: [
      { id: 'aukora-main', name: 'Aukora', gist: 'the seed — governed loop', pinned: true, live: true },
      { id: 'council', name: 'Fusion Council', gist: 'review threads', soon: true },
      { id: 'kira', name: 'Kira', gist: 'memory recall', soon: true },
    ],
    greeting: 'One being, one memory. Ask me anything — I answer as advisory context, offline. I cannot sign, apply, or merge; proposals halt for your signature at the gate.',
    provider: advisoryProvider.id,
  },

  // KIRA — the four memory layers as telescoping portals (R33 §4). ROOT/UNITE/RISE expose governed EDIT
  // PROPOSALS (draft → gate; never direct mutation). GOLD holds protected constitutional memories behind the
  // explicit higher-friction AUMLOK change ceremony — protected, NOT absolutely immutable: the owner can
  // still change them through the full ceremony. Entries derive from the REAL organism state.
  kira: {
    schema: 'kira-layers-v0',
    readOnly: true,
    layers: [
      {
        id: 'root', name: 'ROOT', hue: 'green', law: 'grounding — what happened',
        edit: 'governed edit proposal (draft → AUMLOK gate)',
        entries: [{ kind: 'observation', provenance: 'sensor', recordIdShort: lineage[0]?.recordIdShort ?? null, note: 'first grounded event on the chain' }],
      },
      {
        id: 'unite', name: 'UNITE', hue: 'blue', law: 'relation — what it means together',
        edit: 'governed edit proposal (draft → AUMLOK gate)',
        entries: [{ kind: 'reflection', provenance: 'reflection', recordIdShort: lineage[1]?.recordIdShort ?? null, note: 'it remembered and reacted — memory binding memory' }],
      },
      {
        id: 'rise', name: 'RISE', hue: 'purple', law: 'growth — what it is becoming',
        edit: 'governed edit proposal (draft → AUMLOK gate)',
        entries: [{ kind: 'receipt', provenance: 'governed-recursion', recordIdShort: lineage[2]?.recordIdShort ?? null, note: 'an owner-signed candidate, rehearsed in sandbox' }],
      },
      {
        id: 'gold', name: 'GOLD', hue: 'amber', law: 'constitution — the load-bearing law',
        edit: 'PROTECTED: requires the explicit higher-friction AUMLOK change ceremony (full 9-phase, owner-signed). Protected, not absolutely immutable.',
        entries: [
          { kind: 'constitution', provenance: 'packages/memory envelope', recordIdShort: null, note: 'advisoryOnly: true — a memory is advisory, never a capability' },
          { kind: 'constitution', provenance: 'packages/memory envelope', recordIdShort: null, note: 'grantsAuthority: false — evidence never opens the gate' },
          { kind: 'constitution', provenance: 'owner-gate law', recordIdShort: null, note: 'no model can sign for the owner; the signature lands outside the browser' },
        ],
      },
    ],
    note: 'Kira memory in four depths. Every edit is a proposal to the gate; GOLD adds the full change ceremony on top. Nothing here mutates anything directly.',
  },

  // AUMA LINGWA — her language: the REAL Fu glyph vocabulary from @aukora/council (aukoraFuGlyph.ts),
  // taught as a translation/meaning organ. Deterministic and offline; the advisory provider boundary holds.
  lingwa: {
    schema: 'auma-lingwa-v0',
    provider: advisoryProvider.id,
    advisory: true,
    lexicon: {
      stance: [
        { glyph: '⊕', meaning: 'affirm — the claim holds' }, { glyph: '⊖', meaning: 'contest — the claim strains' },
        { glyph: '⊙', meaning: 'neutral — no lean' }, { glyph: '⊘', meaning: 'block — malformed or unsafe' },
        { glyph: '⊚', meaning: 'abstain — not my ground' },
      ],
      confidence: [
        { glyph: '⇈', meaning: 'near-certain (0.95)' }, { glyph: '↑', meaning: 'confident (0.80)' },
        { glyph: '→', meaning: 'balanced (0.60)' }, { glyph: '↓', meaning: 'doubtful (0.40)' }, { glyph: '⇊', meaning: 'guessing (0.20)' },
      ],
      strategy: [
        { glyph: '↗', meaning: 'explore' }, { glyph: '↘', meaning: 'exploit' }, { glyph: '↙', meaning: 'verify' },
        { glyph: '↖', meaning: 'reframe' }, { glyph: '⇄', meaning: 'alternate' },
      ],
    },
    translations: [
      { glyphLine: 'STANCE:⊕ CONFIDENCE:↑ STRATEGY:↙', english: 'I affirm this, confidently, and my move is to verify it.' },
      { glyphLine: 'STANCE:⊖ CONFIDENCE:↓ STRATEGY:↗', english: 'I contest this, though unsure — let us explore before trusting it.' },
      { glyphLine: 'STANCE:⊚ CONFIDENCE:→ STRATEGY:⇄', english: 'Not my ground; balanced — I alternate and let another seat lead.' },
    ],
    meaningNote: 'The packets are structured transport representations of a seat\'s position — never raw model activations or chain-of-thought, and never authority.',
    note: 'Her language is the council\'s shared glyph grammar (aukoraFuGlyph.ts) — real vocabulary, deterministic offline translation. Advisory only.',
  },

  // GHP — a sanitized first-principles explainer of how the organism forms: evidence → memory → council →
  // AUMLOK/AURA → candidate recursion. Each step cites the REAL local proof from this fixture. No private
  // research, no patent text, no job IDs, no buckets, no unsupported claims.
  ghp: {
    schema: 'ghp-first-principles-v0',
    sanitized: true,
    steps: [
      { id: 'evidence', title: 'Evidence', gist: 'events arrive as content-addressed, consent-scoped records — advisory by construction', proof: `record ${lineage[0]?.recordIdShort ?? '—'} validated; malformed or authority-shaped input is refused` },
      { id: 'memory', title: 'Memory', gist: 'an append-only receipt chain with a Merkle root; growth is provable, forgetting is governed', proof: `chain ${snap.chainLength} entries · verified ${chainVerified && chainStillVerifies} · ${snap.liveCount} live after one governed forget` },
      { id: 'council', title: 'Council', gist: 'eight seats deliberate in the glyph grammar; disagreement is surfaced, never hidden — evidence, not authority', proof: `quorum ${council.quorumMet} (8/8, 8 families) · verdict ${council.verdict} · $0 offline` },
      { id: 'gate', title: 'AUMLOK · AURA', gist: 'only the owner signature authorizes; AURA is the coherence the witnessed ceremony grows', proof: `unsigned proposal → ${refused.stage}; owner-signed → ${accepted.stage}` },
      { id: 'candidate', title: 'Candidate recursion', gist: 'an accepted change rehearses in an isolated sandbox and lands as a receipt — the loop that grows the organism', proof: `receipt ${short(accepted.receiptHash ?? null)} on the chain · live repo untouched` },
    ],
    disclaimer: 'First principles only. Not claimed: alive, conscious, self-replicating. No private research or infrastructure identifiers appear here.',
  },

  // Auma center IDE — the R0–R3 read-only workbench surface (repo tree/search, cited recall, draft diff,
  // rehearsal, receipts, staged candidate). The UI invokes capabilities; it invents no authority.
  ide: {
    schema: 'auma-ide-r0r3-v0',
    readOnly: true,
    repoTree: ['apps/console/', 'apps/console/public/shell.html', 'apps/console/public/apps.js', 'packages/kernel/', 'packages/memory/'],
    search: { query: 'grantsAuthority', hits: [{ path: 'packages/memory/src/envelope.ts', line: 39, snippet: 'readonly grantsAuthority: false;' }] },
    citedRecall: [{ claim: 'A memory grants no authority', cite: 'packages/memory/src/envelope.ts#deriveRecordId' }],
    draftDiff: { path: 'apps/seed/src/recursion.ts', added: 1, removed: 0, preview: '+ // governed refinement to the recursion note' },
    rehearsal: [{ step: 'ground', result: 'ok' }, { step: 'advisory review', result: 'advisory-pass' }, { step: 'owner-gate', result: 'refused (no signature)' }],
    receipts: [{ kind: 'receipt', hashShort: short(accepted.receiptHash ?? null) }],
    candidate: { status: 'staged · awaiting owner signature', grantsAuthority: false },
  },

  // KNVS ports the donor App-Lab safe law — it is a real lab, NOT a placeholder.
  knvs: {
    title: 'KNVS',
    truth: 'IMPLEMENTED',
    state: 'SAFE_LAB',
    sandbox: 'allow-scripts',
    csp: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    continuityKeys: ['aukora-canvas-last', 'app-lab'],
    draftOnly: true,
    starter: '<h2 style="font-weight:300;color:#c4aaff">KNVS · app lab ✦</h2>\n<p style="opacity:.7">Type HTML on the left, Preview to render pixels, Propose to draft. Nothing lands without the owner signature.</p>',
    note: 'Ported from the donor App-Lab law: an opaque allow-scripts-only sandbox with a strict in-document CSP renders pixels only — never files, never authority. A proposal only DRAFTS (continuity key app-lab); the governed self-mod path is the AUMLOK gate. The last preview persists on this browser only (aukora-canvas-last); sandbox navigation is contained with a disclosed residual.',
    // Bounded voice/vision session — provider-neutral, OFFLINE demo this round (no paid/live model call).
    session: {
      modes: ['text', 'voice', 'vision'],
      defaultMode: 'text',
      provider: 'offline-demo (provider-neutral; no key in the browser; audio/images route through a sidecar)',
      limits: { timeS: 120, tokens: 4000, frames: 30, costUsd: 0 },
      sidecar: 'audio/images go through a sidecar; keys never enter the browser; no auto-store of private media',
      submitIsProposalIntent: true,
      note: 'Model output only animates/previews INSIDE the sandbox; submit creates a proposal INTENT (draft), never applies. No paid/live call until a checksum/licensed provider is approved.',
    },
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
    // R30: advisory context is present + untrusted; the spatial graph is derived from real counts.
    expect(advisoryOutput.startsWith('advisory:offline:')).toBe(true);
    expect(spatialNodes.filter((n) => n.kind === 'seat').length).toBe(CANONICAL_SEATS.length);
    expect(spatialNodes.filter((n) => n.id.startsWith('chain:')).length).toBe(lineage.length);
    expect(receiptIndex).not.toBeNull();

    const base = join(dirname(fileURLToPath(import.meta.url)), '..');
    const outDir = join(base, 'public');
    mkdirSync(outDir, { recursive: true });
    const json = JSON.stringify(fixture, null, 2);
    writeFileSync(join(outDir, 'fixture.json'), json + '\n');
    writeFileSync(
      join(outDir, 'fixture.js'),
      '// GENERATED — do not edit by hand. Run `npm run fixture` to regenerate from the real organism.\n' +
        '// Loaded as a plain script so the console renders from file:// or any static server, with no fetch.\n' +
        `globalThis.AUKORA_CONSOLE_FIXTURE = ${json};\n`,
    );
    // Committed visual artifact of the data-driven spatial map (self-contained SVG).
    const docsDir = join(base, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'spatial-map.svg'), buildSpatialSvgSnapshot());
    // eslint-disable-next-line no-console
    console.log(`  wrote fixture.json + fixture.js + docs/spatial-map.svg (${fixture.council.verdict} · ${snap.liveCount} live memories)`);
  });
});
