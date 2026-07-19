// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Canonical repository-identity core (R57A, Sam 4 spatial lane) — the PURE half of the root
// identity gate. Reads nothing and runs nothing: `scripts/verify-repo-identity.mjs` performs the
// one hardened git read and hands the raw bytes here for a verdict.
//
// ACCEPTANCE LAW — byte identity only. An origin URL is canonical IFF it is byte-identical to one
// of the manifest's `acceptedOriginForms`. There is no suffix stripping, case folding, host
// normalization, percent-decoding, or parser-based acceptance: the parser below exists ONLY to
// produce a better refusal detail (donor vs foreign vs malformed) and can never admit a URL.
// Consequence (documented in the manifest): some equivalent-in-practice spellings are
// false-rejects by design; the matcher must never be loosened to admit them.
//
// The TypeScript twin of this logic lives in `apps/seed/src/repoIdentity.ts` (the candidate-stage
// guard). The two implementations are held together by the manifest's shared vector table: the
// suites run every accept and reject vector through BOTH and require identical verdicts, and the
// root gate re-checks the table on every run (`checkVectors`), so drift in either twin fails.
import { readFileSync } from 'node:fs';

/** Typed refusal codes for the wrong-repository outcome. Every non-OK path maps to exactly one. */
export const REFUSAL_CODES = Object.freeze([
  'not-a-repository',      // the target is not a git working tree at all
  'root-mismatch',         // the target directory is not the repository toplevel
  'missing-origin',        // no remote / no remote.origin.url — identity cannot be established
  'extra-remote',          // a remote other than exactly `origin` exists
  'ambiguous-origin',      // remote.origin.url carries more than one value
  'url-rewrite',           // url.<base>.insteadOf / pushInsteadOf keys present in repo config
  'pushurl-mismatch',      // remote.origin.pushurl departs from the canonical identity
  'donor-repository',      // the origin is the read-only donor — never a write target
  'wrong-repository',      // the origin is some other repository or a lookalike
  'malformed-remote-config', // remote config that strict parsing refuses to interpret
  'manifest-invalid',      // the identity manifest itself failed validation — fail closed
  'vector-drift',          // the manifest's own truth table no longer holds — fail closed
  'gate-unwired',          // package.json no longer routes test:all through this gate
  'identity-unestablished', // any unexpected failure — fail closed
]);

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** Load + validate the manifest. The manifest is ALWAYS read from the verifier's own tree, never
 *  from the target repository — a wrong repository must not get to declare itself canonical. */
export function loadManifest(manifestPath) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { ok: false, code: 'manifest-invalid', detail: `unreadable manifest (${e instanceof Error ? e.message.slice(0, 120) : 'unknown'})` };
  }
  if (raw?.schema !== 'aukora-repository-identity/v1' || raw?.version !== 1) {
    return { ok: false, code: 'manifest-invalid', detail: 'manifest schema/version is not aukora-repository-identity/v1' };
  }
  const id = raw.identity;
  if (!isNonEmptyString(id?.host) || !isNonEmptyString(id?.owner) || !isNonEmptyString(id?.repository)) {
    return { ok: false, code: 'manifest-invalid', detail: 'identity.host/owner/repository must be non-empty strings' };
  }
  if (!Array.isArray(raw.acceptedOriginForms) || raw.acceptedOriginForms.length === 0
    || !raw.acceptedOriginForms.every(isNonEmptyString)) {
    return { ok: false, code: 'manifest-invalid', detail: 'acceptedOriginForms must be a non-empty string array' };
  }
  if (!raw.acceptedOriginForms.every((f) => f.includes(`${id.owner}/${id.repository}`))) {
    return { ok: false, code: 'manifest-invalid', detail: 'every accepted form must name the canonical owner/repository' };
  }
  if (!Array.isArray(raw.forbidden) || !Array.isArray(raw.vectors?.accept) || !Array.isArray(raw.vectors?.reject)) {
    return { ok: false, code: 'manifest-invalid', detail: 'forbidden and vectors.accept/reject are required' };
  }
  return { ok: true, manifest: raw };
}

/** Best-effort owner/repo extraction for refusal DETAIL only — never an acceptance path. */
function bestEffortOwnerRepo(url) {
  if (typeof url !== 'string') return null;
  let m = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+\/([^/]+)\/([^/]+)$/); // scheme://host/owner/repo
  if (!m) m = url.match(/^[^@/]+@[^:/]+:([^/]+)\/([^/]+)$/); // user@host:owner/repo (scp form)
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Classify one origin URL against the manifest. 'canonical' requires BYTE identity with an
 *  accepted form; everything else is a refusal verdict with a human detail. */
export function classifyOriginUrl(url, manifest) {
  if (typeof url === 'string' && manifest.acceptedOriginForms.includes(url)) {
    return { verdict: 'canonical', url };
  }
  const shown = typeof url === 'string' ? JSON.stringify(url.slice(0, 120)) : String(url);
  const parsed = bestEffortOwnerRepo(url);
  if (parsed) {
    const bareRepo = parsed.repo.endsWith('.git') ? parsed.repo.slice(0, -4) : parsed.repo;
    for (const f of manifest.forbidden ?? []) {
      if (parsed.owner === f.owner && bareRepo === f.repository) {
        return { verdict: 'donor-repository', detail: `origin ${shown} is the forbidden donor ${f.owner}/${f.repository} (${f.reason})` };
      }
    }
    return { verdict: 'foreign-repository', detail: `origin ${shown} is not byte-identical to any accepted canonical form` };
  }
  return { verdict: 'malformed-origin', detail: `origin ${shown} is not an accepted canonical form` };
}

/** Parse `git config -z --get-regexp` output: entries are `<key>\n<value>` terminated by NUL, so
 *  values containing spaces or newlines cannot confuse the split. */
export function parseZConfig(zRaw) {
  const entries = [];
  for (const chunk of (zRaw ?? '').split('\0')) {
    if (chunk.length === 0) continue;
    const i = chunk.indexOf('\n');
    entries.push(i === -1 ? { key: chunk, value: '' } : { key: chunk.slice(0, i), value: chunk.slice(i + 1) });
  }
  return entries;
}

/** Verdict over the raw `^(remote|url)\.` config of the TARGET repo. Law:
 *   - no url.* rewrite keys (an insteadOf can redirect a byte-canonical origin);
 *   - remote NAMES must be exactly {origin} (case-sensitive; `remote.pushdefault=origin` allowed);
 *   - exactly ONE remote.origin.url value, byte-identical to an accepted form;
 *   - remote.origin.pushurl, when present, must be a single canonical value too;
 *   - anything strict parsing cannot interpret refuses. Fail closed throughout. */
export function evaluateRemoteConfig(zRaw, manifest) {
  const entries = parseZConfig(zRaw);
  if (entries.length === 0) {
    return { ok: false, code: 'missing-origin', detail: 'no remote is configured — repository identity cannot be established' };
  }
  const rewrite = entries.find((e) => e.key === 'url' || e.key.startsWith('url.'));
  if (rewrite) {
    return { ok: false, code: 'url-rewrite', detail: `url.* rewrite keys are not permitted (${rewrite.key})` };
  }
  const names = new Set();
  const urls = [];
  const pushUrls = [];
  for (const e of entries) {
    const parts = e.key.split('.');
    if (parts[0] !== 'remote' || parts.length < 2 || parts.some((p) => p.length === 0)) {
      return { ok: false, code: 'malformed-remote-config', detail: `unexpected config key (${e.key.slice(0, 80)})` };
    }
    if (parts.length === 2) {
      if (parts[1] === 'pushdefault' && e.value === 'origin') continue;
      return { ok: false, code: 'malformed-remote-config', detail: `unexpected remote-section key (${e.key.slice(0, 80)}=${e.value.slice(0, 80)})` };
    }
    const name = parts.slice(1, -1).join('.');
    const leaf = parts[parts.length - 1];
    names.add(name);
    if (name === 'origin' && leaf === 'url') urls.push(e.value);
    if (name === 'origin' && leaf === 'pushurl') pushUrls.push(e.value);
  }
  const others = [...names].filter((n) => n !== 'origin').sort();
  if (others.length > 0) {
    return { ok: false, code: 'extra-remote', detail: `remotes beyond origin are not permitted (${others.join(', ').slice(0, 120)})` };
  }
  if (!names.has('origin') || urls.length === 0) {
    return { ok: false, code: 'missing-origin', detail: 'remote.origin.url is not configured — repository identity cannot be established' };
  }
  if (urls.length > 1) {
    return { ok: false, code: 'ambiguous-origin', detail: `remote.origin.url carries ${urls.length} values` };
  }
  const cls = classifyOriginUrl(urls[0], manifest);
  if (cls.verdict !== 'canonical') {
    return { ok: false, code: cls.verdict === 'donor-repository' ? 'donor-repository' : 'wrong-repository', detail: cls.detail };
  }
  if (pushUrls.length > 1) {
    return { ok: false, code: 'malformed-remote-config', detail: `remote.origin.pushurl carries ${pushUrls.length} values` };
  }
  if (pushUrls.length === 1) {
    const pcls = classifyOriginUrl(pushUrls[0], manifest);
    if (pcls.verdict !== 'canonical') {
      return { ok: false, code: pcls.verdict === 'donor-repository' ? 'donor-repository' : 'pushurl-mismatch', detail: pcls.detail };
    }
  }
  return { ok: true, originUrl: urls[0], pushUrl: pushUrls[0] ?? null };
}

/** Re-prove the manifest's own truth table: every accept vector must be canonical, every reject
 *  vector must not. A gate whose fixtures have drifted refuses to certify anything. */
export function checkVectors(manifest) {
  for (const v of manifest.vectors.accept) {
    if (classifyOriginUrl(v, manifest).verdict !== 'canonical') {
      return { ok: false, code: 'vector-drift', detail: `accept vector no longer classifies canonical: ${JSON.stringify(String(v).slice(0, 120))}` };
    }
  }
  for (const v of manifest.vectors.reject) {
    if (classifyOriginUrl(v.url, manifest).verdict === 'canonical') {
      return { ok: false, code: 'vector-drift', detail: `reject vector classifies canonical: ${JSON.stringify(String(v.url).slice(0, 120))} (${v.why})` };
    }
  }
  return { ok: true };
}
