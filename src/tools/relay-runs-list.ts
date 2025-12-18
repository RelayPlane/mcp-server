/**
 * relay_runs_list Tool
 *
 * List recent workflow runs for debugging and reference.
 */

import { z } from 'zod';
import { getRecentRuns, type RunRecord } from './run-store.js';
import { getConfig } from '../config.js';

export const relayRunsListSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe('Number of runs to return (default: 10, max: 50)'),
});

export type RelayRunsListInput = z.infer<typeof relayRunsListSchema>;

export interface RunSummary {
  runId: string;
  type: 'single' | 'workflow';
  name?: string;
  model?: string;
  success: boolean;
  startTime: string;
  durationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  traceUrl: string;
  contextReduction?: string;
}

export interface RelayRunsListResponse {
  runs: RunSummary[];
  total: number;
}

export async function relayRunsList(
  input: RelayRunsListInput
): Promise<RelayRunsListResponse> {
  const limit = input.limit || 10;
  const runs = getRecentRuns(limit);
  const config = getConfig();

  const summaries: RunSummary[] = runs.map((run: RunRecord) => ({
    runId: run.runId,
    type: run.type,
    name: run.type === 'workflow' ? run.workflowName : undefined,
    model: run.type === 'single' ? run.model : undefined,
    success: run.success,
    startTime: run.startTime.toISOString(),
    durationMs: run.durationMs,
    totalTokens: run.usage.totalTokens,
    estimatedCostUsd: run.usage.estimatedProviderCostUsd,
    traceUrl: `${config.traceUrlBase}/${run.runId}`,
    contextReduction: run.contextReduction,
  }));

  return {
    runs: summaries,
    total: summaries.length,
  };
}

export const relayRunsListDefinition = {
  name: 'relay_runs_list',
  description: 'List recent workflow runs for debugging and reference.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Number of runs to return (default: 10, max: 50)',
      },
    },
  },
};
