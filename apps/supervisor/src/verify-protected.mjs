// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// Protected-class verifier: re-hash the pinned supervisor surface. Exit 1 on drift.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyProtected } from './supervisor.mjs';
const bad = verifyProtected();
if (bad.length) { console.error('PROTECTED SURFACE DRIFTED:\n' + bad.join('\n')); process.exit(1); }
console.log('protected surface verified — supervisor/policy/gateway match protected.sha256');
