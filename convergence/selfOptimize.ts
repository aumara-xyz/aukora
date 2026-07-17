// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KIRA self-optimization — the memory metacortex (pure, portable).
 *
 * The memory system watches its own performance: hit rates, query latency,
 * index coverage, and decay effectiveness. It produces tuning recommendations
 * that a reactive adapter (apps/brain) can apply. Pure: no I/O, no clock,
 * no randomness — all metrics are supplied by the caller.
 *
 * Convergence: self-optimization closes the loop between indexing, decay,
 * and recall — the memory system improves itself without external intervention.
 */

import type { InvertedIndex, IndexStats } from './searchIndex.js';
import { PHI, PHI_INV } from './decay.js';

/** A single query event recorded by the reactive adapter. */
export interface QueryEvent {
  readonly queryText: string;
  readonly resultsCount: number;
  /** How many of the top-5 results the user clicked/used. */
  readonly top5HitsUsed: number;
  /** Time from query to results (ms). */
  readonly latencyMs: number;
  /** Whether the user found what they needed. */
  readonly satisfied: boolean;
}

/** Aggregated performance metrics. */
export interface PerformanceMetrics {
  readonly totalQueries: number;
  readonly hitRate: number;
  readonly avgLatencyMs: number;
  readonly satisfactionRate: number;
  readonly zeroResultRate: number;
}

/** A tuning recommendation from the self-optimizer. */
export interface TuningRecommendation {
  readonly action: 'rebuild_index' | 'extend_half_life' | 'shorten_half_life' | 'add_shear' | 'no_change';
  readonly reason: string;
  readonly priority: number; // 0-1, higher = more urgent
  readonly expectedImprovement: number; // estimated % improvement
}

/** Compute metrics from query event history. Pure. */
export function computeMetrics(events: readonly QueryEvent[]): PerformanceMetrics {
  if (events.length === 0) {
    return { totalQueries: 0, hitRate: 0, avgLatencyMs: 0, satisfactionRate: 0, zeroResultRate: 0 };
  }

  const satisfied = events.filter(e => e.satisfied).length;
  const zeroResults = events.filter(e => e.resultsCount === 0).length;
  const totalLatency = events.reduce((sum, e) => sum + e.latencyMs, 0);
  const totalHitsUsed = events.reduce((sum, e) => sum + e.top5HitsUsed, 0);
  const maxHitsPossible = events.length * 5;

  return {
    totalQueries: events.length,
    hitRate: maxHitsPossible > 0 ? totalHitsUsed / maxHitsPossible : 0,
    avgLatencyMs: totalLatency / events.length,
    satisfactionRate: satisfied / events.length,
    zeroResultRate: zeroResults / events.length,
  };
}

/**
 * The self-optimizer: analyze metrics + index stats and produce recommendations.
 * Pure: all inputs supplied, all outputs deterministic.
 */
export function selfOptimize(
  metrics: PerformanceMetrics,
  indexStats: IndexStats,
  currentHalfLifeMs: number,
): readonly TuningRecommendation[] {
  const recommendations: TuningRecommendation[] = [];

  // Rule 1: Zero-result rate > 20% → rebuild index (terms not covered)
  if (metrics.zeroResultRate > 0.2) {
    recommendations.push({
      action: 'rebuild_index',
      reason: `Zero-result rate ${(metrics.zeroResultRate * 100).toFixed(1)}% exceeds 20% threshold. ` +
        `Index covers ${indexStats.termCount} terms but ${indexStats.uncoveredTerms.length} terms uncovered.`,
      priority: Math.min(1, metrics.zeroResultRate),
      expectedImprovement: metrics.zeroResultRate * 0.7,
    });
  }

  // Rule 2: Satisfaction < 50% AND avg relevance declining → shorten half-life
  // (old memories dominating results, need faster turnover)
  if (metrics.satisfactionRate < 0.5 && metrics.totalQueries > 10) {
    const newHalfLife = Math.max(3600_000, currentHalfLifeMs / PHI); // min 1 hour
    recommendations.push({
      action: 'shorten_half_life',
      reason: `Satisfaction rate ${(metrics.satisfactionRate * 100).toFixed(1)}% below 50%. ` +
        `Decay half-life ${(currentHalfLifeMs / 3600_000).toFixed(1)}h may be too long — ` +
        `stale memories dominating results. Propose ${(newHalfLife / 3600_000).toFixed(1)}h.`,
      priority: 1 - metrics.satisfactionRate,
      expectedImprovement: (1 - metrics.satisfactionRate) * 0.4,
    });
  }

  // Rule 3: Hit rate > 80% but satisfaction < 50% → memories contradicting
  // (results found but wrong — contradiction shear needed)
  if (metrics.hitRate > 0.8 && metrics.satisfactionRate < 0.5) {
    recommendations.push({
      action: 'add_shear',
      reason: `High hit rate (${(metrics.hitRate * 100).toFixed(1)}%) but low satisfaction ` +
        `(${(metrics.satisfactionRate * 100).toFixed(1)}%). Memories are being found but are ` +
        `contradictory or irrelevant. Apply ~ operator to detect contradictions.`,
      priority: 0.8,
      expectedImprovement: 0.3,
    });
  }

  // Rule 4: Everything good → extend half-life for deeper memory
  if (metrics.satisfactionRate > 0.8 && metrics.hitRate > 0.6 && metrics.zeroResultRate < 0.05) {
    const newHalfLife = currentHalfLifeMs * PHI;
    recommendations.push({
      action: 'extend_half_life',
      reason: `System healthy: satisfaction ${(metrics.satisfactionRate * 100).toFixed(1)}%, ` +
        `hit rate ${(metrics.hitRate * 100).toFixed(1)}%. Can afford longer memory ` +
        `(${((newHalfLife) / 3600_000).toFixed(1)}h) for deeper archaeological layers.`,
      priority: 0.3,
      expectedImprovement: 0.1,
    });
  }

  // Default: no change needed
  if (recommendations.length === 0) {
    recommendations.push({
      action: 'no_change',
      reason: `Metrics within normal ranges: satisfaction ${(metrics.satisfactionRate * 100).toFixed(1)}%, ` +
        `zero-result ${(metrics.zeroResultRate * 100).toFixed(1)}%, hit rate ${(metrics.hitRate * 100).toFixed(1)}%.`,
      priority: 0.1,
      expectedImprovement: 0,
    });
  }

  // Sort by priority descending
  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Adaptive half-life: compute optimal half-life based on query patterns.
 * Uses φ-scaled adjustments from the golden ratio.
 */
export function adaptiveHalfLife(
  currentHalfLifeMs: number,
  metrics: PerformanceMetrics,
  targetSatisfaction: number = 0.75,
): number {
  const error = targetSatisfaction - metrics.satisfactionRate;

  if (Math.abs(error) < 0.1) return currentHalfLifeMs; // Within tolerance

  if (error > 0) {
    // Satisfaction too low → shorter half-life (fresher memories)
    return Math.max(3600_000, currentHalfLifeMs / (1 + error * PHI_INV));
  } else {
    // Satisfaction high → longer half-life (deeper memory)
    return currentHalfLifeMs * (1 + Math.abs(error) * PHI_INV);
  }
}

/** Memory system health report. Pure. */
export interface HealthReport {
  readonly status: 'healthy' | 'degraded' | 'critical';
  readonly metrics: PerformanceMetrics;
  readonly recommendations: readonly TuningRecommendation[];
  readonly adaptiveHalfLifeMs: number;
}

/** Full health check: metrics + recommendations + adaptive params. Pure. */
export function healthCheck(
  events: readonly QueryEvent[],
  indexStats: IndexStats,
  currentHalfLifeMs: number,
): HealthReport {
  const metrics = computeMetrics(events);
  const recommendations = selfOptimize(metrics, indexStats, currentHalfLifeMs);
  const adaptive = adaptiveHalfLife(currentHalfLifeMs, metrics);

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (metrics.satisfactionRate < 0.3 || metrics.zeroResultRate > 0.5) {
    status = 'critical';
  } else if (metrics.satisfactionRate < 0.6 || metrics.zeroResultRate > 0.2) {
    status = 'degraded';
  }

  return { status, metrics, recommendations, adaptiveHalfLifeMs: adaptive };
}
