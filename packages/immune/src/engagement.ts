// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ENGAGEMENT — Rules of Engagement for immune responses (pure, portable).
 *
 * Pattern from Decepticon: Every attack action requires an engagement
 * package (RoE, ConOps, Deconfliction Plan, OPPLAN with MITRE ATT&CK mapping).
 *
 * grantsAuthority: false — the immune system never overrides Aukora.
 */

import type { ThreatSignature } from './thymus.js';

/** Rules of Engagement for the immune system. */
export interface RoE {
  readonly maxEscalationLevel: number;
  readonly allowedActions: readonly DefensiveAction[];
  readonly prohibitedActions: readonly string[];
  readonly autoQuarantine: boolean;
  readonly councilApprovalRequired: boolean;
  readonly mitreMapping: boolean;
}

/** Defensive actions the immune system can take. */
export type DefensiveAction =
  | 'patrol_scan'
  | 'alert_log'
  | 'elevate_inflammation'
  | 'quarantine_content'
  | 'block_egress'
  | 'council_report'
  | 'memory_snapshot'
  | 'signature_update'
  | 'force_diversity';

/** Standard RoE — balanced security with council oversight. */
export const STANDARD_ROE: RoE = {
  maxEscalationLevel: 8,
  allowedActions: ['patrol_scan', 'alert_log', 'elevate_inflammation', 'council_report', 'memory_snapshot', 'signature_update', 'force_diversity'],
  prohibitedActions: ['quarantine_content', 'block_egress'],
  autoQuarantine: false,
  councilApprovalRequired: true,
  mitreMapping: true,
};

/** Strict RoE — maximum security, more auto-actions allowed. */
export const STRICT_ROE: RoE = {
  maxEscalationLevel: 13,
  allowedActions: ['patrol_scan', 'alert_log', 'elevate_inflammation', 'quarantine_content', 'block_egress', 'council_report', 'memory_snapshot', 'signature_update', 'force_diversity'],
  prohibitedActions: [],
  autoQuarantine: true,
  councilApprovalRequired: false,
  mitreMapping: true,
};

/** Permissive RoE — observation only, minimal intervention. */
export const PERMISSIVE_ROE: RoE = {
  maxEscalationLevel: 2,
  allowedActions: ['patrol_scan', 'alert_log', 'memory_snapshot'],
  prohibitedActions: ['quarantine_content', 'block_egress', 'elevate_inflammation', 'council_report', 'force_diversity'],
  autoQuarantine: false,
  councilApprovalRequired: true,
  mitreMapping: false,
};

/** An operational plan for a defensive engagement. */
export interface OperationalPlan {
  readonly phases: readonly OpPhase[];
  readonly estimatedDurationMs: number;
  readonly rollbackPlan: string;
}

export interface OpPhase {
  readonly name: string;
  readonly action: DefensiveAction;
  readonly durationMs: number;
  readonly successCriteria: string;
}

/** Engagement package — every defensive action gets one. */
export interface EngagementPackage {
  readonly authorized: boolean;
  readonly roe: RoE;
  readonly threat: ThreatSignature;
  readonly opplan: OperationalPlan;
  readonly deconfliction: readonly string[];
  readonly timestampMs: number;
}

/** Create an engagement package for a threat under given RoE. */
export function createEngagement(
  threat: ThreatSignature,
  roe: RoE,
  nowMs?: number,
): EngagementPackage {
  const escalationLevel = threat.severity === 'critical' ? 8 :
    threat.severity === 'high' ? 5 :
    threat.severity === 'medium' ? 2 : 1;

  const authorized = escalationLevel <= roe.maxEscalationLevel;

  const phases: OpPhase[] = [
    { name: 'detect', action: 'patrol_scan', durationMs: 1000, successCriteria: 'Threat confirmed' },
    { name: 'report', action: 'council_report', durationMs: 5000, successCriteria: 'Council notified' },
  ];

  if (roe.autoQuarantine) {
    phases.push({ name: 'contain', action: 'quarantine_content', durationMs: 10000, successCriteria: 'Content quarantined' });
  }

  const opplan: OperationalPlan = {
    phases,
    estimatedDurationMs: phases.reduce((s, p) => s + p.durationMs, 0),
    rollbackPlan: 'Restore from memory snapshot, revert inflammation level, notify council of rollback.',
  };

  return {
    authorized,
    roe,
    threat,
    opplan,
    deconfliction: [
      'advisory-only',
      'grantsAuthority:false',
      'mitre-mapping:' + (roe.mitreMapping ? 'enabled' : 'disabled'),
    ],
    timestampMs: nowMs ?? Date.now(),
  };
}

/** Check if a defensive action is authorized under given RoE. */
export function isActionAuthorized(action: DefensiveAction, roe: RoE): boolean {
  return roe.allowedActions.includes(action) && !roe.prohibitedActions.includes(action);
}
