// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Protected-ref + tree isolation snapshots (#22 overnight · HARDEN GIT). Pins: a snapshot captures the protected
 * refs (canonical order) + primary tree hash; verifyIsolation is byte-exact and fail-closed — any moved/added/
 * removed protected ref or any tree change is an isolation violation whose outcome must be QUARANTINED.
 */
import { describe, it, expect } from 'vitest';
import {
  snapshotProtected, verifyIsolation, isolationQuarantineReason, refSnapshotGrantsAuthority,
  type RefReader,
} from '../src/index.js';

const NOW = '2026-07-17T00:00:00.000Z';
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const PROTECTED = ['HEAD', 'refs/heads/main'];

function reader(refs: Record<string, string | null>, treeHash: string): RefReader {
  return { readRef: (name) => refs[name] ?? null, readTreeHash: () => treeHash };
}

describe('protected snapshot — capture', () => {
  it('captures protected refs in canonical sorted order with the tree hash; grants no authority', () => {
    const snap = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': A }, 'tree-1'), ['refs/heads/main', 'HEAD', 'HEAD'], NOW);
    expect(snap.refs.map((r) => r.name)).toEqual(['HEAD', 'refs/heads/main']); // sorted + de-duped
    expect(snap.treeHash).toBe('tree-1');
    expect(snap.grantsAuthority).toBe(false);
    expect(refSnapshotGrantsAuthority()).toBe(false);
  });

  it('a malformed (non-40-hex) ref value is normalized to null so comparison is over shaped values only', () => {
    const snap = snapshotProtected(reader({ HEAD: 'not-a-sha', 'refs/heads/main': A }, 't'), PROTECTED, NOW);
    expect(snap.refs.find((r) => r.name === 'HEAD')?.sha).toBeNull();
  });

  it('an absent ref is captured as null (its presence/absence is pinned and compared)', () => {
    const snap = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': null }, 't'), PROTECTED, NOW);
    expect(snap.refs.find((r) => r.name === 'refs/heads/main')?.sha).toBeNull();
  });
});

describe('verifyIsolation — byte-exact, fail-closed', () => {
  const before = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': A }, 'tree-1'), PROTECTED, NOW);

  it('identical before/after → intact', () => {
    const after = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': A }, 'tree-1'), PROTECTED, NOW);
    const v = verifyIsolation(before, after);
    expect(v.ok).toBe(true);
    expect(v.reasonClass).toBe('isolation:intact');
    expect(isolationQuarantineReason(v)).toBeNull();
  });

  it('a moved protected ref → violation lists the ref and quarantines', () => {
    const after = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': B }, 'tree-1'), PROTECTED, NOW);
    const v = verifyIsolation(before, after);
    expect(v.ok).toBe(false);
    expect(v.reasonClass).toBe('isolation:protected-ref-moved');
    expect((v as { movedRefs: readonly string[] }).movedRefs).toEqual(['refs/heads/main']);
    expect(isolationQuarantineReason(v)).toBe('quarantine:isolation:protected-ref-moved');
  });

  it('a changed primary tree with unchanged refs → tree-changed violation', () => {
    const after = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': A }, 'tree-2'), PROTECTED, NOW);
    const v = verifyIsolation(before, after);
    expect(v.ok).toBe(false);
    expect(v.reasonClass).toBe('isolation:tree-changed');
    expect((v as { treeChanged: boolean }).treeChanged).toBe(true);
  });

  it('a ref that APPEARED (null → sha) or DISAPPEARED (sha → null) is a violation', () => {
    const beforeAbsent = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': null }, 'tree-1'), PROTECTED, NOW);
    const afterPresent = snapshotProtected(reader({ HEAD: A, 'refs/heads/main': A }, 'tree-1'), PROTECTED, NOW);
    expect(verifyIsolation(beforeAbsent, afterPresent).reasonClass).toBe('isolation:protected-ref-moved');
    expect(verifyIsolation(afterPresent, beforeAbsent).reasonClass).toBe('isolation:protected-ref-moved');
  });

  it('a different protected SET (names differ) is itself a violation, not a silent pass', () => {
    const narrower = snapshotProtected(reader({ HEAD: A }, 'tree-1'), ['HEAD'], NOW);
    const v = verifyIsolation(before, narrower);
    expect(v.ok).toBe(false);
    expect(v.reasonClass).toBe('isolation:protected-set-mismatch');
  });
});
