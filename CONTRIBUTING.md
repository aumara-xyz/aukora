# Contributing

This repository contains the canonical portable core only. Product surfaces (chat, dashboard, Wolf, spatial UI) are in separate repositories.

## What Belongs Here

- Post-quantum cryptographic primitives
- Evidence validation and immune gates
- Advisory council logic
- Governance law (staleness, policy, consent)
- Deterministic tests and conformance vectors

## What Does NOT Belong Here

- Applications or product UI
- Deployment-specific code
- Research documents or hypotheses
- Model weights or training artifacts
- Private planning or strategy material

## Pull Request Requirements

1. All tests pass (`npm run test:release`)
2. No new I/O in portable packages (no fs, network, env)
3. Authority containment maintained (`*GrantsAuthority() === false`)
4. Truth labels updated for any new capability
5. Provenance manifest updated for any donor material
