// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * LIMITED RHYTHM (R35): exactly one cron — an hourly heartbeat that recomputes the reactive snapshot. Rhythm
 * is cadence only: it carries no payload, no authority, and no external effect. Deliberately sparse; new crons
 * require a deliberate round, not a habit.
 */
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('brain heartbeat (rhythm only)', { hours: 1 }, internal.memory.heartbeat, {});

export default crons;
