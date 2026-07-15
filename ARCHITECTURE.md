# Aukora Architecture

## Package Graph

```
                    @aukora/workspace
                    (root, private)
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
   @aukora/kernel   @aukora/evidence  @aukora/council
   (crypto + law)   (immune gate)     (advisory council)
```

**Dependency direction**: Packages never import from apps. Apps (aukora-symbiote, aukora-fu) import from packages.

## Capability Truth Table

| Capability | Package | Status | Tests |
|------------|---------|--------|-------|
| ML-DSA-65 post-quantum signing | `@aukora/kernel` | CANONICAL_PORTABLE | 397 |
| Merkle append-only receipt history | `@aukora/kernel` | CANONICAL_PORTABLE | 397 |
| Authority schema + registry | `@aukora/kernel` | CANONICAL_PORTABLE | 397 |
| Staleness law ( expiry → flagged ) | `@aukora/kernel` | CANONICAL_PORTABLE | 80 |
| EvidencePack V1 D6 (9-projection secret scanner) | `@aukora/evidence` | CANONICAL_PORTABLE | 146 |
| Canonical digest (JCS-aligned) | `@aukora/evidence` | CANONICAL_PORTABLE | 146 |
| Fail-closed validator (positive-allow-list) | `@aukora/evidence` | CANONICAL_PORTABLE | 146 |
| 8-seat Fu Council H1-H8 | `@aukora/council` | CANONICAL_PORTABLE | 60+ |
| KL-divergence perceiver + phase-lock | `@aukora/council` | CANONICAL_PORTABLE | 60+ |
| Spend metering ($2/pass, $10/day) | `@aukora/council` | CANONICAL_PORTABLE | 60+ |
| Core memory envelope (consent scope) | — | DESIGN_ONLY | 0 |
| Policy kernel (ring table) | — | DESIGN_ONLY | 0 |
| Proposal intent (self-mod governance) | — | DESIGN_ONLY | 0 |
| Resource governor | — | DESIGN_ONLY | 0 |
| Digital metabolism / DHFI | — | RESEARCH_ONLY | 0 |
| Borromean topology | — | RESEARCH_ONLY | 0 |

## Authority Containment

Every package exports `*GrantsAuthority(): false` as a testable invariant. No code path assigns `grantsAuthority: true`. The council is advisory-only. Signing and live-apply require owner AUMLOK authorization and are NOT in these portable packages.

## Naming Discipline

Production code uses boring engineering names:
- `ResourceSignal`, `AdmissionController`, `CoordinationSignal`, `IncidentShape`
- `cascade`, `interlocked`

No Borromean, trefoil, biological isomorphism, consciousness, or aliveness claims in production code.
