// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * TrustedStateStore — the PROTECTED, crash-safe, single-writer persistence for the kernel's constitutional
 * trusted state (Diamond overnight, issue #21). It lives OUTSIDE Convex and OUTSIDE model-facing code.
 *
 * THE LOAD-BEARING GUARANTEE: consumed authorization IDs and the kernel receipt head survive REAL process death
 * and refuse rollback. The store composes the kernel's PURE `decide()` (the existing consume + head-advance
 * reducer — unchanged) with an atomic, journalled, fsync'd commit, so a decision is durable BEFORE any Git
 * effect. A crash before the commit leaves the PRIOR state (nothing consumed); a crash after it leaves the new
 * state (consumed exactly once) — never a torn in-between.
 *
 * NEVER stored here: proposal plaintext, private keys, signing material, model state, or Convex authority — the
 * persisted `TrustedStateV1` is the kernel's own content-free shape (roots, consumed ids, receipt head), plus a
 * content-free PREPARED effect descriptor (hashes + a path + a class).
 *
 * HONEST LIMIT (in scope tonight): rollback refusal compares the loaded state's `receiptHead.count` against a
 * retained high-water file. A single restore of the state file alone is refused. A CONSISTENT two-file rewrite
 * (state + high-water together) is the same completeness limit a plain hash chain has — closed only by an
 * external monotonic source (signed head / hardware root), which is explicitly OUT of tonight's scope.
 */
import { openSync, writeSync, fsyncSync, closeSync, renameSync, readFileSync, existsSync, mkdirSync, rmSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decide as kernelDecide, assertTrustedState, type TrustedStateV1, type KernelRequestV1, type KernelResultV1 } from '@aukora/kernel';

export const STORE_SCHEMA_VERSION = 1 as const;

/** Content-free descriptor of the effect an authorization prepares. No bytes, no keys, no plaintext. */
export interface PreparedEffectV1 {
  readonly effectId: string;         // caller-supplied stable id (e.g. a 64-hex hash)
  readonly consumptionId: string;    // the authorization id consumed for this effect
  readonly descriptorKind: string;   // a class, e.g. 'git-candidate'
  readonly targetPath: string;
  readonly contentHash: string;      // hash of the intended bytes; the bytes live elsewhere
  readonly receiptCountAfter: number;
  readonly preparedAtMs: number;
}

/** The on-disk record: the kernel trusted state + the append-only prepared effects + the store schema tag. */
export interface PersistedTrustedRecordV1 {
  readonly storeSchema: typeof STORE_SCHEMA_VERSION;
  readonly state: TrustedStateV1;
  readonly prepared: readonly PreparedEffectV1[];
}

export class RollbackRefusedError extends Error {}
export class WriterLockedError extends Error {}
export class TrustedStoreCorruptError extends Error {}

/** Crash-injection seam: called before each durable step with a label; a throw simulates power loss there. */
export type CrashHook = (label: 'journal-write' | 'journal-fsync' | 'rename' | 'dir-fsync' | 'highwater') => void;
const NO_CRASH: CrashHook = () => {};

export type AuthorizeOutcome =
  | { readonly ok: true; readonly decision: KernelResultV1['decision']; readonly prepared: PreparedEffectV1; readonly record: PersistedTrustedRecordV1 }
  | { readonly ok: false; readonly decision: KernelResultV1['decision'] };

export interface TrustedStoreOptions {
  /** Injected for tests; defaults to the real kernel `decide` (production path is byte-identical). */
  readonly decide?: typeof kernelDecide;
  readonly crashHook?: CrashHook;
}

const STATE_FILE = 'trusted-state.json';
const HIGHWATER_FILE = 'receipt-highwater.json';
const LOCK_FILE = 'writer.lock';
const TMP_FILE = 'trusted-state.tmp';

export class TrustedStateStore {
  private locked = false;
  private readonly decide: typeof kernelDecide;
  private readonly crash: CrashHook;

  constructor(private readonly dir: string, opts: TrustedStoreOptions = {}) {
    this.decide = opts.decide ?? kernelDecide;
    this.crash = opts.crashHook ?? NO_CRASH;
  }

  private p(name: string): string { return join(this.dir, name); }

  /** Acquire the single-writer lock (atomic O_EXCL). A lock held by a DEAD pid is reclaimed; a live one refuses. */
  open(): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    try { chmodSync(this.dir, 0o700); } catch { /* best effort */ }
    const lock = this.p(LOCK_FILE);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(lock, 'wx', 0o600); // wx = O_CREAT|O_EXCL — atomic
        writeSync(fd, String(process.pid)); fsyncSync(fd); closeSync(fd);
        this.locked = true;
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        const raw = readFileSync(lock, 'utf8').trim();
        const holder = Number(raw);
        // Single-writer: a lock held by ANY LIVE pid (including another instance in this same process) refuses.
        // Only a lock whose holder is a POSITIVE integer pid that is provably DEAD (a crashed writer) is reclaimed.
        // An empty/partial/non-positive lock is a writer that has O_EXCL-created the file but not yet fsync'd its
        // pid — a LIVE contended lock, NOT stale. Treat it as held (refuse + let the caller's retry loop wait for
        // the holder to finish and release), never delete it — that TOCTOU would admit two writers.
        if (raw === '' || !Number.isInteger(holder) || holder <= 0 || this.pidAlive(holder)) {
          throw new WriterLockedError(`trusted store locked (holder ${raw || 'in-progress'})`);
        }
        rmSync(lock, { force: true }); // stale lock (dead pid) — reclaim, then retry once
      }
    }
    throw new WriterLockedError('could not acquire trusted store writer lock');
  }

  close(): void {
    if (this.locked) { rmSync(this.p(LOCK_FILE), { force: true }); this.locked = false; }
  }

  private pidAlive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch { return false; } }

  private readHighWater(): number {
    const f = this.p(HIGHWATER_FILE);
    if (!existsSync(f)) return 0;
    const n = Number(JSON.parse(readFileSync(f, 'utf8')).count);
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  }

  /** Durable read + rollback refusal. A fresh store returns `genesis`. A loaded count below the high-water is a rollback. */
  load(genesis: TrustedStateV1): PersistedTrustedRecordV1 {
    const f = this.p(STATE_FILE);
    if (!existsSync(f)) {
      assertTrustedState(genesis); // fail-closed on a bad genesis
      return { storeSchema: STORE_SCHEMA_VERSION, state: genesis, prepared: [] };
    }
    let rec: PersistedTrustedRecordV1;
    try { rec = JSON.parse(readFileSync(f, 'utf8')) as PersistedTrustedRecordV1; }
    catch (e) { throw new TrustedStoreCorruptError(`trusted state unparseable: ${String(e).slice(0, 80)}`); }
    if (rec.storeSchema !== STORE_SCHEMA_VERSION) throw new TrustedStoreCorruptError('unknown store schema (migration required)');
    assertTrustedState(rec.state); // reuse the kernel's fail-closed validator (sorted ids, coherent head, canonical roots)
    const highWater = this.readHighWater();
    if (rec.state.receiptHead.count < highWater) {
      throw new RollbackRefusedError(`trusted state rolled back: loaded count ${rec.state.receiptHead.count} < high-water ${highWater}`);
    }
    return rec;
  }

  /** Crash-safe atomic commit: write tmp → fsync → atomic rename → fsync dir → advance high-water. */
  private commit(record: PersistedTrustedRecordV1): void {
    if (!this.locked) throw new WriterLockedError('commit without the writer lock');
    const tmp = this.p(TMP_FILE);
    const body = JSON.stringify(record);
    this.crash('journal-write');
    const fd = openSync(tmp, 'w', 0o600);
    try {
      writeSync(fd, body);
      this.crash('journal-fsync');
      fsyncSync(fd);
    } finally { closeSync(fd); }
    this.crash('rename');
    renameSync(tmp, this.p(STATE_FILE)); // atomic on POSIX — the durability point
    // fsync the directory so the rename itself is durable across power loss
    this.crash('dir-fsync');
    try { const dfd = openSync(this.dir, 'r'); try { fsyncSync(dfd); } finally { closeSync(dfd); } } catch { /* dir fsync best-effort on some FS */ }
    this.crash('highwater');
    const hwFd = openSync(this.p(HIGHWATER_FILE), 'w', 0o600);
    try { writeSync(hwFd, JSON.stringify({ count: record.state.receiptHead.count })); fsyncSync(hwFd); } finally { closeSync(hwFd); }
  }

  /**
   * THE atomic authorizeAndPrepare transaction. Loads the durable state, runs the kernel `decide()` (replay,
   * authorization, and receipt-head advance are ITS law over the durable consumed set), and on `allowed`
   * persists the next state + the PREPARED effect atomically BEFORE returning — so the caller performs the Git
   * effect only after the consumption is durable. A refusal persists nothing.
   */
  authorizeAndPrepare(args: {
    genesis: TrustedStateV1;
    request: KernelRequestV1;
    policyBytes: Uint8Array;
    effect: { effectId: string; descriptorKind: string; targetPath: string; contentHash: string };
    nowMs: number;
  }): AuthorizeOutcome {
    const current = this.load(args.genesis);
    const result = this.decide(args.request, current.state, args.policyBytes, args.nowMs);
    if (result.decision.status !== 'allowed') {
      return { ok: false, decision: result.decision };
    }
    const prepared: PreparedEffectV1 = {
      effectId: args.effect.effectId,
      consumptionId: args.request.consumptionId ?? '',
      descriptorKind: args.effect.descriptorKind,
      targetPath: args.effect.targetPath,
      contentHash: args.effect.contentHash,
      receiptCountAfter: result.nextState.receiptHead.count,
      preparedAtMs: args.nowMs,
    };
    const record: PersistedTrustedRecordV1 = {
      storeSchema: STORE_SCHEMA_VERSION,
      state: result.nextState,
      prepared: [...current.prepared, prepared],
    };
    this.commit(record); // durable BEFORE any Git effect the caller runs next
    return { ok: true, decision: result.decision, prepared, record };
  }

  /** Sanity: the persisted files are owner-only (0600). Returns the octal perms of the state file, or null. */
  statePerms(): number | null {
    const f = this.p(STATE_FILE);
    return existsSync(f) ? (statSync(f).mode & 0o777) : null;
  }
}

/** The store persists and refuses; it grants no authority (the kernel `decide` it wraps already grants none). */
export function trustedStateStoreGrantsAuthority(): false {
  return false;
}
