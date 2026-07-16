// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Reactive memory store — the organism brain adapter.
 *
 * Persists KIRA memory records into an append-only, receipt-chained log (reusing the canonical
 * @aukora/kernel receipt chain + Merkle root — no second hash implementation), and maintains a REACTIVE
 * snapshot (live count, chain length, head hash, Merkle root) that recomputes on every ingest/forget so the
 * brain's view always reflects its memory. Growth is provable: live memory count strictly rises across ingests.
 *
 * Governed forgetting: an owner-authorized tombstone makes a record invisible to recall (its plaintext is never
 * returned again) and appends a CONTENT-FREE tombstone to the chain — the historical chain is never rewritten,
 * so the audit that a memory existed and was forgotten is preserved.
 *
 * This is an APP ADAPTER (Node). It holds in-memory state; the Convex-backed variant in ./convex mirrors the
 * same contracts. Owner verification for forgetting is INJECTED — the store never holds a key or signs.
 */
import { receiptChainHash, verifyReceiptChain, type ReceiptChainEntryV1, type ReceiptChainVerdict } from '@aukora/kernel/evidence';
import { merkleRoot } from '@aukora/kernel/merkle';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { validateMemoryRecord, recall, liveMemoryCount, type MemoryRecordV1, type RecallQuery, type RecallHit } from '@aukora/memory';

export interface BrainSnapshot {
  /** Non-forgotten memory records — the growing memory. */
  readonly liveCount: number;
  /** Total append-only chain entries (memories + tombstones). */
  readonly chainLength: number;
  readonly forgottenCount: number;
  /** Reactive head of the receipt chain. */
  readonly headHash: string | null;
  /** Reactive Merkle root over all chain-entry hashes. */
  readonly merkleRootHex: string | null;
  readonly lastEventAt: string | null;
}

export type IngestVerdict =
  | { readonly ok: true; readonly recordId: string; readonly chainHash: string; readonly snapshot: BrainSnapshot }
  | { readonly ok: false; readonly refusal: string };

export type ForgetVerdict =
  | { readonly ok: true; readonly recordId: string; readonly snapshot: BrainSnapshot }
  | { readonly ok: false; readonly refusal: string };

export class ReactiveMemoryStore {
  private readonly entries: ReceiptChainEntryV1[] = [];
  private readonly records: MemoryRecordV1[] = [];
  private readonly forgotten = new Set<string>();
  private lastEventAt: string | null = null;
  private snap: BrainSnapshot;

  constructor() {
    this.snap = this.recompute();
  }

  private appendEntry(payload: { readonly [key: string]: unknown }): string {
    const prevHash = this.entries.length ? this.entries[this.entries.length - 1].chainHash : null;
    const chainHash = receiptChainHash(payload as never, prevHash);
    this.entries.push({ payload: payload as never, prevHash, chainHash });
    return chainHash;
  }

  /** Ingest a memory. Malformed or authority-shaped input is REFUSED (fail-closed); it never enters the chain. */
  ingest(record: unknown): IngestVerdict {
    const r = validateMemoryRecord(record);
    if (r === null) return { ok: false, refusal: 'refused: malformed or authority-shaped memory' };
    const chainHash = this.appendEntry({ ...r });
    this.records.push(r);
    this.lastEventAt = r.createdAt;
    this.snap = this.recompute();
    return { ok: true, recordId: r.recordId, chainHash, snapshot: this.snap };
  }

  /** Deterministic recall; forgotten records are invisible and their content is never surfaced. */
  recall(query: RecallQuery): RecallHit[] {
    return recall(this.records, query, this.forgotten);
  }

  /**
   * Governed forgetting. `verifyOwner` is the injected AUMLOK owner authorization check (the seed provides a
   * real Ed25519 verification over the forget request). Fail-closed: no valid owner authorization ⇒ refused.
   */
  forget(recordId: string, verifyOwner: () => boolean, at: string): ForgetVerdict {
    if (!this.records.some((r) => r.recordId === recordId)) return { ok: false, refusal: 'refused: unknown record' };
    if (!verifyOwner()) return { ok: false, refusal: 'refused: forgetting requires owner authorization' };
    this.forgotten.add(recordId); // read-time invisibility
    this.appendEntry({ kind: 'tombstone', recordId, at }); // content-free audit; chain not rewritten
    this.lastEventAt = at;
    this.snap = this.recompute();
    return { ok: true, recordId, snapshot: this.snap };
  }

  snapshot(): BrainSnapshot {
    return this.snap;
  }

  /** The canonical receipt-chain verifier — tamper of any link is detected. */
  verifyChain(): ReceiptChainVerdict {
    return verifyReceiptChain(this.entries);
  }

  chain(): readonly ReceiptChainEntryV1[] {
    return this.entries;
  }

  private recompute(): BrainSnapshot {
    const headHash = this.entries.length ? this.entries[this.entries.length - 1].chainHash : null;
    const merkleRootHex = this.entries.length
      ? bytesToHex(merkleRoot(this.entries.map((e) => hexToBytes(e.chainHash))))
      : null;
    return {
      liveCount: liveMemoryCount(this.records, this.forgotten),
      chainLength: this.entries.length,
      forgottenCount: this.forgotten.size,
      headHash,
      merkleRootHex,
      lastEventAt: this.lastEventAt,
    };
  }
}
