// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aumara
// Package entry barrel for @aukora/council. Kept OUT of src/ so the canonical sources under
// src/ stay a pure two-module set (the "glyph is consumed only by the council" invariant holds).
// This barrel adds no logic; it re-exports the public surface of the two canonical primitives.
export * from './src/aukoraFuCouncil';
export * from './src/aukoraFuGlyph';
