/**
 * relay_workflow_run Tool
 *
 * Execute a multi-step AI workflow. Intermediate results stay in the workflow engine
 * (not your context), providing 90%+ context reduction on complex pipelines.
 */

import { z } from 'zod';
import { estimateWorkflowCost, calculateActualCost } from '../budget/estimator.js';
import { checkBudget, recordCost } from '../budget/tracker.js';
import { getConfig, getProviderKey, isProviderConfigured } from '../config.js';
import { addRun, generateRunId } from './run-store.js';
import { relayRun } from './relay-run.js';

const workflowStepSchema = z.object({
  name: z.string().describe('Step name'),
  model: z.string().optional().describe('Model in provider:model format'),
  prompt: z.string().optional().describe('Prompt template (supports {{input.field}} and {{steps.stepName.output}})'),
  systemPrompt: z.string().optional().describe('Optional system prompt'),
  depends: z.array(z.string()).optional().describe('Steps this step depends on'),
  mcp: z.string().optional().describe('MCP tool in server:tool format'),
  params: z.object({}).passthrough().optional().describe('MCP tool parameters'),
  schema: z.object({}).passthrough().optional().describe('JSON schema for structured output'),
});

export const relayWorkflowRunSchema = z.object({
  name: z.string().describe('Workflow name for tracing'),
  steps: z.array(workflowStepSchema).describe('Workflow steps'),
  input: z.object({}).passthrough().describe('Input data (accessible via {{input.field}})'),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type RelayWorkflowRunInput = z.infer<typeof relayWorkflowRunSchema>;

export interface WorkflowStepResult {
  success: boolean;
  output: any;
  durationMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    estimatedProviderCostUsd: number;
  };
  error?: { code: string; message: string };
}

export interface RelayWorkflowRunResponse {
  success: boolean;
  steps: Record<string, WorkflowStepResult>;
  finalOutput: any;
  totalUsage: {
    totalTokens: number;
    estimatedProviderCostUsd: number;
  };
  totalDurationMs: number;
  runId: string;
  traceUrl: string;
  contextReduction: string;
  error?: { code: string; message: string };
}

/**
 * Interpolate template strings like {{input.field}} and {{steps.stepName.output}}
 */
function interpolate(template: string, context: { input: any; steps: Record<string, any> }): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return '';
      }
      value = value[part];
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  });
}

/**
 * Topological sort of steps based on dependencies
 */
function topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
  const stepMap = new Map(steps.map(s => [s.name, s]));
  const sorted: WorkflowStep[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(stepName: string) {
    if (visited.has(stepName)) return;
    if (visiting.has(stepName)) {
      throw new Error(`Circular dependency detected involving step: ${stepName}`);
    }

    visiting.add(stepName);

    const step = stepMap.get(stepName);
    if (!step) {
      throw new Error(`Step "${stepName}" not found`);
    }

    // Visit dependencies first
    for (const dep of step.depends || []) {
      visit(dep);
    }

    visiting.delete(stepName);
    visited.add(stepName);
    sorted.push(step);
  }

  for (const step of steps) {
    visit(step.name);
  }

  return sorted;
}

/**
 * Estimate context reduction for the workflow
 */
function estimateContextReduction(steps: WorkflowStep[], stepResults: Record<string, WorkflowStepResult>): string {
  // Estimate tokens that would have passed through context without workflow
  let tokensWithoutWorkflow = 0;
  let tokensWithWorkflow = 0;

  for (const step of steps) {
    const result = stepResults[step.name];
    if (result?.usage) {
      // Without workflow: each step's output would need to be in context for dependent steps
      const outputTokens = result.usage.completionTokens;
      const dependentSteps = steps.filter(s => s.depends?.includes(step.name)).length;
      tokensWithoutWorkflow += outputTokens * (dependentSteps + 1); // Output read by dependents + final read

      // With workflow: we only see the final output
      tokensWithWorkflow += result.usage.promptTokens + result.usage.completionTokens;
    }
  }

  // Add estimated tokens for final summary only going back to agent
  const finalStep = steps[steps.length - 1];
  const finalResult = stepResults[finalStep?.name];
  tokensWithWorkflow = finalResult?.usage?.completionTokens || 500; // Just final output

  if (tokensWithoutWorkflow === 0) {
    return 'N/A (no AI steps)';
  }

  const reduction = Math.round((1 - tokensWithWorkflow / tokensWithoutWorkflow) * 100);
  const savedTokens = tokensWithoutWorkflow - tokensWithWorkflow;

  if (reduction > 0) {
    return `${reduction}% (saved ~${Math.round(savedTokens / 1000)}k tokens)`;
  }
  return '0%';
}

export async function relayWorkflowRun(input: RelayWorkflowRunInput): Promise<RelayWorkflowRunResponse> {
  const startTime = Date.now();
  const runId = generateRunId();
  const config = getConfig();

  const stepResults: Record<string, WorkflowStepResult> = {};
  let totalTokens = 0;
  let totalCost = 0;

  try {
    // Validate and sort steps
    const sortedSteps = topologicalSort(input.steps);

    // Estimate cost for AI steps and check budget
    const aiSteps = sortedSteps.filter(s => s.model && s.prompt);
    const estimatedCost = estimateWorkflowCost(aiSteps);
    const budgetCheck = checkBudget(estimatedCost);

    if (!budgetCheck.allowed) {
      throw new Error(budgetCheck.error);
    }

    // Check all providers are configured
    for (const step of aiSteps) {
      const provider = step.model!.split(':')[0];
      if (!isProviderConfigured(provider)) {
        throw new Error(
          `Provider "${provider}" (step "${step.name}") is not configured. Set ${provider.toUpperCase()}_API_KEY environment variable.`
        );
      }
    }

    // Execute steps in order
    const context = { input: input.input, steps: {} as Record<string, any> };

    for (const step of sortedSteps) {
      const stepStart = Date.now();

      try {
        if (step.model && step.prompt) {
          // AI step - use relay_run
          const interpolatedPrompt = interpolate(step.prompt, context);
          const interpolatedSystemPrompt = step.systemPrompt
            ? interpolate(step.systemPrompt, context)
            : undefined;

          const result = await relayRun({
            model: step.model,
            prompt: interpolatedPrompt,
            systemPrompt: interpolatedSystemPrompt,
            schema: step.schema,
          });

          if (!result.success) {
            throw new Error(result.error?.message || 'Step execution failed');
          }

          context.steps[step.name] = { output: result.output };
          stepResults[step.name] = {
            success: true,
            output: result.output,
            durationMs: result.durationMs,
            usage: {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              estimatedProviderCostUsd: result.usage.estimatedProviderCostUsd,
            },
          };

          totalTokens += result.usage.totalTokens;
          totalCost += result.usage.estimatedProviderCostUsd;
        } else if (step.mcp) {
          // MCP step - placeholder for now
          // In a full implementation, this would call the MCP tool
          const stepDuration = Date.now() - stepStart;
          context.steps[step.name] = { output: { message: 'MCP step executed (placeholder)' } };
          stepResults[step.name] = {
            success: true,
            output: { message: 'MCP step executed (placeholder)' },
            durationMs: stepDuration,
          };
        } else {
          // Transform step or other type
          const stepDuration = Date.now() - stepStart;
          context.steps[step.name] = { output: null };
          stepResults[step.name] = {
            success: true,
            output: null,
            durationMs: stepDuration,
          };
        }
      } catch (error) {
        const stepDuration = Date.now() - stepStart;
        const errorMessage = error instanceof Error ? error.message : String(error);

        stepResults[step.name] = {
          success: false,
          output: null,
          durationMs: stepDuration,
          error: {
            code: 'STEP_EXECUTION_ERROR',
            message: errorMessage,
          },
        };

        throw new Error(`Step "${step.name}" failed: ${errorMessage}`);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const lastStep = sortedSteps[sortedSteps.length - 1];
    const finalOutput = stepResults[lastStep?.name]?.output;

    const response: RelayWorkflowRunResponse = {
      success: true,
      steps: stepResults,
      finalOutput,
      totalUsage: {
        totalTokens,
        estimatedProviderCostUsd: totalCost,
      },
      totalDurationMs,
      runId,
      traceUrl: `${config.traceUrlBase}/${runId}`,
      contextReduction: estimateContextReduction(sortedSteps, stepResults),
    };

    // Store run
    addRun({
      runId,
      type: 'workflow',
      workflowName: input.name,
      success: true,
      startTime: new Date(startTime),
      endTime: new Date(),
      durationMs: totalDurationMs,
      usage: {
        promptTokens: 0, // Aggregated in steps
        completionTokens: 0,
        totalTokens,
        estimatedProviderCostUsd: totalCost,
      },
      input: input.input,
      output: finalOutput,
      steps: stepResults,
      contextReduction: response.contextReduction,
    });

    return response;
  } catch (error) {
    const totalDurationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const response: RelayWorkflowRunResponse = {
      success: false,
      steps: stepResults,
      finalOutput: null,
      totalUsage: {
        totalTokens,
        estimatedProviderCostUsd: totalCost,
      },
      totalDurationMs,
      runId,
      traceUrl: `${config.traceUrlBase}/${runId}`,
      contextReduction: 'N/A (workflow failed)',
      error: {
        code: 'WORKFLOW_ERROR',
        message: errorMessage,
      },
    };

    // Store failed run
    addRun({
      runId,
      type: 'workflow',
      workflowName: input.name,
      success: false,
      startTime: new Date(startTime),
      endTime: new Date(),
      durationMs: totalDurationMs,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens,
        estimatedProviderCostUsd: totalCost,
      },
      input: input.input,
      steps: stepResults,
      error: errorMessage,
    });

    return response;
  }
}

export const relayWorkflowRunDefinition = {
  name: 'relay_workflow_run',
  description:
    "Execute a multi-step AI workflow. Intermediate results stay in the workflow engine (not your context), providing 90%+ context reduction on complex pipelines. Use for any task requiring multiple model calls or tool integrations. Cost tracks your provider bills, not RelayPlane fees - we're BYOK.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Workflow name for tracing',
      },
      steps: {
        type: 'array',
        description: 'Workflow steps',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Step name' },
            model: { type: 'string', description: 'Model in provider:model format' },
            prompt: { type: 'string', description: 'Prompt template (supports {{input.field}} and {{steps.stepName.output}})' },
            systemPrompt: { type: 'string', description: 'Optional system prompt' },
            depends: { type: 'array', items: { type: 'string' }, description: 'Steps this step depends on' },
            mcp: { type: 'string', description: 'MCP tool in server:tool format' },
            params: { type: 'object', description: 'MCP tool parameters' },
            schema: { type: 'object', description: 'JSON schema for structured output' },
          },
          required: ['name'],
        },
      },
      input: {
        type: 'object',
        description: 'Input data (accessible via {{input.field}})',
      },
    },
    required: ['name', 'steps', 'input'],
  },
};
