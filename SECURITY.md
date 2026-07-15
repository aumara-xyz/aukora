# Security Policy

## Reporting

Security issues should be reported to peter@aumara.xyz. Do not open public issues for security vulnerabilities.

## Authority Containment

The Aukora packages are advisory-only. No package grants authority. Every package exports a testable `*GrantsAuthority(): false` invariant.

## Boundary

Portable packages (`@aukora/kernel`, `@aukora/evidence`, `@aukora/council`) perform no filesystem I/O, no network calls, and no environment access. The only exceptions:
- `@aukora/kernel` uses `node:crypto` for SHA-256 hashing
- `@aukora/council` uses `node:crypto` for SHA-256 hashing
- `@aukora/evidence` uses `node:crypto` for SHA-256 hashing

No `Date.now()`, no `process.env`, no `fs`, no `fetch` in portable code.

## Hardening History

- D1-D6: EvidencePack immune gate (146 tests, 0 P0/P1)
- H1-H8: Fu Council hardening (60+ tests)
- Staleness brick: 80 tests
