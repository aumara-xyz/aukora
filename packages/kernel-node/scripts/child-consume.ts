// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 2 harness child — a SEPARATE OS process that consumes an authorization against the real
 * TrustedStateStore, so the parent test can `kill -9` it and prove the consumption survives REAL process death.
 * Run by the test via `node --experimental-transform-types child-consume.ts <dir> <consumptionId> <mode>`.
 * `mode`: `commit-hang` (commit, print marker, then wait to be SIGKILLed) · `commit-exit` (commit then exit 0) ·
 * `crash-before-rename` (throw at the rename step — nothing is committed). Self-contained: an inline stub decide
 * that faithfully mirrors the kernel reducer's persistence-relevant law (replay + consume + head advance).
 */
import { TrustedStateStore, type CrashHook } from '../src/trustedStateStore.ts';

const [dir, consumptionId, mode] = process.argv.slice(2);
const genesis = () => ({ schema: 'aukora-trusted-state-v1', salama: { active: false, reason: null }, trustedRoots: [], consumedIds: [], receiptHead: { count: 0, headHash: null } });
const stub = (request: any, state: any) => {
  const cid = request.consumptionId;
  if (cid !== null && state.consumedIds.includes(cid)) return { schema: 'aukora-kernel-result-v1', decision: { status: 'refused', code: 'replay', ring: 'self-modify', authorizedRootId: null }, nextState: state, receiptDraft: {} };
  const consumedIds = cid !== null ? [...state.consumedIds, cid].sort() : state.consumedIds;
  return { schema: 'aukora-kernel-result-v1', decision: { status: 'allowed', code: 'allowed', ring: 'self-modify', authorizedRootId: 'root-1' }, nextState: { ...state, consumedIds, receiptHead: { count: state.receiptHead.count + 1, headHash: 'd'.repeat(64) } }, receiptDraft: {} };
};

const crashHook: CrashHook = mode === 'crash-before-rename' ? (label) => { if (label === 'rename') { console.log('CRASH_AT_RENAME'); process.exit(37); } } : () => {};
const store = new TrustedStateStore(dir, { decide: stub as never, crashHook });

// Retry the single-writer lock briefly (a concurrent sibling may hold it); a live-holder throw is expected.
let opened = false;
for (let i = 0; i < 40 && !opened; i++) {
  try { store.open(); opened = true; }
  catch { if (i === 39) { console.log('LOCK_REFUSED'); process.exit(2); } await new Promise((r) => setTimeout(r, 50)); }
}

try {
  const r = store.authorizeAndPrepare({
    genesis: genesis() as never, request: { consumptionId } as never, policyBytes: new Uint8Array(),
    effect: { effectId: 'e-' + consumptionId, descriptorKind: 'git-candidate', targetPath: 'apps/x/y.ts', contentHash: 'c'.repeat(64) }, nowMs: 2_000,
  });
  console.log(r.ok ? `COMMITTED:${r.record.state.receiptHead.count}` : `REFUSED:${r.decision.code}`);
} catch (e) {
  console.log('THREW:' + String((e as Error).message).slice(0, 40));
  process.exit(37);
}

if (mode === 'commit-hang') {
  // stay alive holding the lock so the parent can SIGKILL us AFTER the commit is durable on disk.
  setInterval(() => {}, 1000);
} else {
  store.close();
  process.exit(0);
}
