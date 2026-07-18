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

/** Strict RoE — maximum recommended response coverage. Council/owner approval is STILL required (no preset ever
 *  bypasses it): the immune system only ever RECOMMENDS a broader plan, it never self-authorizes. */
export const STRICT_ROE: RoE = {
  maxEscalationLevel: 13,
  allowedActions: ['patrol_scan', 'alert_log', 'elevate_inflammation', 'quarantine_content', 'block_egress', 'council_report', 'memory_snapshot', 'signature_update', 'force_diversity'],
  prohibitedActions: [],
  autoQuarantine: true,
  councilApprovalRequired: true, // no RoE preset may bypass council/owner approval
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

/** Engagement package — a RECOMMENDATION for a defensive response. It never authorizes or executes anything. */
export interface EngagementPackage {
  /** RoE-recommended: escalation within bounds AND every planned action permitted by the RoE. A RECOMMENDATION
   *  flag only — it is NOT an authorization (see grantsAuthority / executionAllowed, both hard-false). */
  readonly recommended: boolean;
  readonly roe: RoE;
  readonly threat: ThreatSignature;
  readonly opplan: OperationalPlan;
  /** Every planned-phase action, and whether each is permitted under the RoE (recommendation-only). */
  readonly plannedActions: readonly DefensiveAction[];
  readonly deconfliction: readonly string[];
  readonly timestampMs: number;
  /** Recommendation-only markers — no immune output ever claims authorization or execution. */
  readonly advisoryOnly: true;
  readonly grantsAuthority: false;
  readonly executionAllowed: false;
  /** The recommendation always routes through council/owner approval; the immune system never self-authorizes. */
  readonly councilApprovalRequired: true;
}

/** Create an engagement RECOMMENDATION for a threat under given RoE. `nowMs` is required (deterministic; no wall clock). */
export function createEngagement(
  threat: ThreatSignature,
  roe: RoE,
  nowMs: number,
): EngagementPackage {
  // NORMALIZE the RoE so council/owner approval is STRUCTURALLY required — a caller cannot smuggle in a RoE with
  // councilApprovalRequired:false and end up with a package whose nested `roe` contradicts its top-level marker.
  const normalizedRoe: RoE = roe.councilApprovalRequired ? roe : { ...roe, councilApprovalRequired: true };
  roe = normalizedRoe;

  const escalationLevel = threat.severity === 'critical' ? 8 :
    threat.severity === 'high' ? 5 :
    threat.severity === 'medium' ? 2 : 1;

  const phases: OpPhase[] = [
    { name: 'detect', action: 'patrol_scan', durationMs: 1000, successCriteria: 'Threat confirmed' },
    { name: 'report', action: 'council_report', durationMs: 5000, successCriteria: 'Council notified' },
  ];

  if (roe.autoQuarantine) {
    phases.push({ name: 'contain', action: 'quarantine_content', durationMs: 10000, successCriteria: 'Content quarantined' });
  }

  const plannedActions = phases.map((p) => p.action);
  // A recommendation is only "recommended" if the escalation is in bounds AND EVERY planned action is permitted
  // by the RoE — a plan containing a prohibited action can never be recommended (the old code checked escalation
  // alone, so a plan with a prohibited `council_report` was still marked authorized).
  const recommended = escalationLevel <= roe.maxEscalationLevel && plannedActions.every((a) => isActionAuthorized(a, roe));

  const opplan: OperationalPlan = {
    phases,
    estimatedDurationMs: phases.reduce((s, p) => s + p.durationMs, 0),
    rollbackPlan: 'Restore from memory snapshot, revert inflammation level, notify council of rollback.',
  };

  return {
    recommended,
    roe,
    threat,
    opplan,
    plannedActions,
    deconfliction: [
      'advisory-only',
      'grantsAuthority:false',
      'executionAllowed:false',
      'councilApprovalRequired:true',
      'mitre-mapping:' + (roe.mitreMapping ? 'enabled' : 'disabled'),
    ],
    timestampMs: nowMs,
    advisoryOnly: true,
    grantsAuthority: false,
    executionAllowed: false,
    councilApprovalRequired: true,
  };
}

/** Check if a defensive action is authorized under given RoE. */
export function isActionAuthorized(action: DefensiveAction, roe: RoE): boolean {
  return roe.allowedActions.includes(action) && !roe.prohibitedActions.includes(action);
}
