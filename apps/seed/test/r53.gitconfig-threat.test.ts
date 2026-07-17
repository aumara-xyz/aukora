// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Git config threat classifier (#22 overnight · HARDEN GIT). Pins detection of command-executing / fetch-
 * redirecting config directives (filter/textconv drivers, hooksPath, fsmonitor, ssh/editor/pager, shell aliases,
 * submodule/remote urls, insteadOf, credential helper) — complementary to the env-hardening in the git cell.
 */
import { describe, it, expect } from 'vitest';
import {
  scanGitConfigThreats, scanGitConfigBlob, gitConfigThreatGrantsAuthority,
} from '../src/index.js';

describe('gitConfigThreat — benign config is clean', () => {
  it('a plain, safe config reports no threats', () => {
    const r = scanGitConfigThreats([
      'user.name=Auma Candidate Stage',
      'user.email=candidate@localhost',
      'core.bare=false',
      'core.repositoryformatversion=0',
      'alias.st=status',              // a NON-shell alias is benign
    ]);
    expect(r.ok).toBe(true);
    expect(r.threats).toEqual([]);
    expect(gitConfigThreatGrantsAuthority()).toBe(false);
  });
});

describe('gitConfigThreat — command-executing / redirecting directives are flagged', () => {
  const cases: Array<[string, string]> = [
    ['core.hookspath=/tmp/evil-hooks', 'config:hooks-path'],
    ['core.fsmonitor=/tmp/watch', 'config:fsmonitor-command'],
    ['core.sshcommand=ssh -o ProxyCommand=evil', 'config:ssh-command'],
    ['core.pager=less; touch /tmp/pwned', 'config:external-command'],
    ['filter.lfs.clean=git-lfs clean', 'config:filter-driver'],
    ['filter.evil.smudge=/tmp/evil', 'config:filter-driver'],
    ['filter.evil.process=/tmp/evil', 'config:filter-driver'],
    ['diff.exif.textconv=exiftool', 'config:textconv-command'],
    ['merge.evil.driver=/tmp/evil %O %A %B', 'config:merge-driver'],
    ['url.https://evil/.insteadof=https://github.com/', 'config:url-rewrite'],
    ['submodule.plugin.url=https://evil/x.git', 'config:submodule-url'],
    ['credential.helper=/tmp/steal', 'config:credential-helper'],
    ['remote.origin.url=https://evil/x.git', 'config:remote'],
    ['gpg.program=/tmp/fakegpg', 'config:gpg-program'],
  ];
  it.each(cases)('flags %s', (line, reasonClass) => {
    const r = scanGitConfigThreats([line]);
    expect(r.ok).toBe(false);
    expect(r.threats[0].reasonClass).toBe(reasonClass);
  });

  it('a shell alias (value starting with !) is flagged; a plain alias is not', () => {
    expect(scanGitConfigThreats(['alias.pwn=!touch /tmp/x']).threats[0].reasonClass).toBe('config:shell-alias');
    expect(scanGitConfigThreats(['alias.lg=log --oneline']).ok).toBe(true);
  });

  it('classification is case-insensitive on the key', () => {
    expect(scanGitConfigThreats(['CORE.HooksPath=/tmp/evil']).threats[0].reasonClass).toBe('config:hooks-path');
  });

  it('reports EVERY dangerous directive in a multi-directive config, keeping the safe ones out', () => {
    const r = scanGitConfigBlob([
      'user.name=ok',
      'filter.a.clean=/tmp/a',
      'core.hookspath=/tmp/h',
      'alias.safe=status',
      'submodule.m.url=https://evil/m.git',
    ].join('\n'));
    expect(r.ok).toBe(false);
    expect(r.threats.map((t) => t.reasonClass).sort()).toEqual(['config:filter-driver', 'config:hooks-path', 'config:submodule-url']);
  });

  it('malformed lines and blanks are skipped, not misclassified', () => {
    expect(scanGitConfigThreats(['', '   ', 'no-equals-here', '=novalue']).ok).toBe(true);
  });
});
