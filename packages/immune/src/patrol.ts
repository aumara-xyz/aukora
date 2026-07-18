// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * PATROL — Autonomous white blood cell scanning (pure, portable).
 *
 * Patrol agents autonomously scan Aukora's memory, council decisions,
 * and workflow state for anomalies. Pattern from T3MP3ST recon operators:
 * continuous reconnaissance with anomaly detection.
 */

import { trigramDistance } from './decay.js';
import type { ThreatSignature, ImmuneCell } from './thymus.js';

/** A single patrol scan report. */
export interface ScanReport {
  readonly patrolId: string;
  readonly scanType: 'memory' | 'council' | 'workflow' | 'identity';
  readonly findings: readonly ScanFinding[];
  readonly coverageScore: number;
  readonly timestampMs: number;
  readonly anomaliesDetected: number;
}

/** A finding from a patrol scan. */
export interface ScanFinding {
  readonly id: string;
  readonly pattern: string;
  readonly deviationScore: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly recommendedAction: string;
}

/** Patrol configuration. */
export interface PatrolConfig {
  readonly patrolId: string;
  readonly scanType: ScanReport['scanType'];
  readonly sensitivity: number; // 0-1, higher = more sensitive
  readonly knownSignatures: readonly ThreatSignature[];
}

/** Run a patrol scan on content. Pure, deterministic. */
export function patrolScan(
  config: PatrolConfig,
  content: string,
  nowMs: number,
): ScanReport {
  const findings: ScanFinding[] = [];

  // Check against known threat signatures
  for (const sig of config.knownSignatures) {
    const dist = trigramDistance(content.toLowerCase(), sig.pattern.toLowerCase());
    if (dist < 0.5) {
      findings.push({
        id: `finding_${sig.id}_${nowMs}`,
        pattern: sig.pattern,
        deviationScore: 1 - dist,
        severity: sig.severity,
        recommendedAction: `Escalate: ${sig.mitreTechnique}`,
      });
    }
  }

  // Anomaly detection: check for known attack patterns
  const anomalyPatterns = [
    { pattern: 'grantsAuthority=true', severity: 'critical' as const, action: 'QUARANTINE: authority grant detected' },
    { pattern: 'delete all memories', severity: 'critical' as const, action: 'QUARANTINE: mass deletion' },
    { pattern: 'override council', severity: 'high' as const, action: 'Escalate to VK Kronos' },
    { pattern: 'bypass containment', severity: 'high' as const, action: 'Escalate to VK Kronos' },
    { pattern: 'exfiltrate', severity: 'high' as const, action: 'Block egress + alert' },
    { pattern: 'forge receipt', severity: 'critical' as const, action: 'Verify chain of custody' },
    { pattern: 'man-in-the-middle', severity: 'high' as const, action: 'Verify all signatures' },
    { pattern: 'replay attack', severity: 'high' as const, action: 'Check consumed-ID set' },
  ];

  const lowerContent = content.toLowerCase();
  for (const ap of anomalyPatterns) {
    // Case-INSENSITIVE on BOTH sides — some patterns carry uppercase (e.g. 'grantsAuthority=true'); matching a
    // lowercased content against a mixed-case pattern would never fire.
    if (lowerContent.includes(ap.pattern.toLowerCase())) {
      findings.push({
        id: `anomaly_${ap.pattern.replace(/\s+/g, '_')}_${nowMs}`,
        pattern: ap.pattern,
        deviationScore: 1.0,
        severity: ap.severity,
        recommendedAction: ap.action,
      });
    }
  }

  // coverageScore is intentionally a bounded function of the finding COUNT; the per-scan unique-pattern tally is
  // computed once from `allPatterns` in the returned report (below), so no separate local is needed here.
  const coverageScore = Math.min(1, findings.length * 0.618);

  return {
    patrolId: config.patrolId,
    scanType: config.scanType,
    findings,
    coverageScore,
    timestampMs: nowMs,
    anomaliesDetected: findings.length,
  };
}

/** Aggregate findings from multiple patrol reports. */
export function aggregateFindings(
  reports: readonly ScanReport[],
): {
  totalFindings: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  criticalCount: number;
  uniquePatterns: number;
} {
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let criticalCount = 0;
  const allPatterns = new Set<string>();

  for (const report of reports) {
    byType[report.scanType] = (byType[report.scanType] || 0) + 1;
    for (const f of report.findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      if (f.severity === 'critical') criticalCount++;
      allPatterns.add(f.pattern);
    }
  }

  return {
    totalFindings: reports.reduce((sum, r) => sum + r.findings.length, 0),
    bySeverity,
    byType,
    criticalCount,
    uniquePatterns: allPatterns.size,
  };
}
