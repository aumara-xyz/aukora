// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * BrainProvider — the provider-neutral model boundary.
 *
 * The organism attaches real brains without bundling weights. This interface is the only seam a model plugs
 * into; the deterministic offline provider makes every demo/test reproducible with no network and no paid call.
 * The model manifest is truth-labeled and carries NO weights, endpoint IDs, job IDs, bucket IDs, or tokens.
 */
import { canonicalHash } from '@aukora/kernel/canonical';

export interface BrainProvider {
  readonly id: string;
  /** Advisory completion. Never grants authority; never signs. */
  complete(prompt: string): Promise<string>;
}

/** Deterministic, offline, no-network provider. Same prompt ⇒ same output, forever. */
export class DeterministicOfflineProvider implements BrainProvider {
  readonly id = 'deterministic-offline-v0';
  async complete(prompt: string): Promise<string> {
    return `advisory:offline:${canonicalHash({ prompt }).slice(0, 24)}`;
  }
}

export type ModelTruth = 'IMPLEMENTED' | 'AVAILABLE_PRIVATE' | 'BLOCKED' | 'DESIGN_ONLY' | 'REJECTED';

export interface ModelManifestEntry {
  readonly id: string;
  readonly label: string;
  readonly truth: ModelTruth;
  /** Public sha256 of a sanitized artifact manifest, only when real evidence exists. Never a weight. */
  readonly sha256?: string;
}

/**
 * Sanitized model manifest. Truth labels only — no weights, no private infra identifiers. Liquid/Nemotron stay
 * BLOCKED and the router seed DESIGN_ONLY until exact artifacts prove otherwise.
 */
export const MODEL_MANIFEST: readonly ModelManifestEntry[] = [
  { id: 'qwen2.5-vl-32b-instruct', label: 'base vision-language model', truth: 'AVAILABLE_PRIVATE' },
  { id: 'auma-vl-lora', label: 'Auma-VL LoRA ladder (v5..v17 reported; provenance pending)', truth: 'AVAILABLE_PRIVATE' },
  { id: 'liquid-candidate', label: 'Liquid AI candidate (licensing concerns)', truth: 'BLOCKED' },
  { id: 'nemotron', label: 'Nemotron', truth: 'BLOCKED' },
  { id: 'router-3b-seed', label: '~3B router seed', truth: 'DESIGN_ONLY' },
];

/** A provider grants no authority. Constant. */
export function providerGrantsAuthority(): false {
  return false;
}
