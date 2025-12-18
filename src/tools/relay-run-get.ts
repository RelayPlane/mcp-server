/**
 * relay_run_get Tool
 *
 * Get full details of a specific run including all step outputs and trace URL.
 */

import { z } from 'zod';
import { getRunById, type RunRecord } from './run-store.js';
import { getConfig } from '../config.js';

export const relayRunGetSchema = z.object({
  runId: z.string().describe('The run ID to retrieve'),
});

export type RelayRunGetInput = z.infer<typeof relayRunGetSchema>;

export interface RelayRunGetResponse {
  found: boolean;
  run?: {
    runId: string;
    type: 'single' | 'workflow';
    name?: string;
    model?: string;
    success: boolean;
    startTime: string;
    endTime: string;
    durationMs: number;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedProviderCostUsd: number;
    };
    input?: any;
    output?: any;
    steps?: Record<string, any>;
    error?: string;
    traceUrl: string;
    contextReduction?: string;
  };
  error?: string;
}

export async function relayRunGet(
  input: RelayRunGetInput
): Promise<RelayRunGetResponse> {
  const run = getRunById(input.runId);
  const config = getConfig();

  if (!run) {
    return {
      found: false,
      error: `Run with ID "${input.runId}" not found. Note: Run history is stored in memory and clears on server restart.`,
    };
  }

  return {
    found: true,
    run: {
      runId: run.runId,
      type: run.type,
      name: run.type === 'workflow' ? run.workflowName : undefined,
      model: run.type === 'single' ? run.model : undefined,
      success: run.success,
      startTime: run.startTime.toISOString(),
      endTime: run.endTime.toISOString(),
      durationMs: run.durationMs,
      usage: run.usage,
      input: run.input,
      output: run.output,
      steps: run.steps,
      error: run.error,
      traceUrl: `${config.traceUrlBase}/${run.runId}`,
      contextReduction: run.contextReduction,
    },
  };
}

export const relayRunGetDefinition = {
  name: 'relay_run_get',
  description: 'Get full details of a specific run including all step outputs and trace URL.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      runId: {
        type: 'string',
        description: 'The run ID to retrieve',
      },
    },
    required: ['runId'],
  },
};
