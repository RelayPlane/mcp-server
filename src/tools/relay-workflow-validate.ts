/**
 * relay_workflow_validate Tool
 *
 * Validate workflow structure without making any LLM calls (free).
 * Checks DAG structure (no cycles), dependency references, and model ID format.
 */

import { z } from 'zod';
import { PRICING } from '../budget/estimator.js';

const workflowStepSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  systemPrompt: z.string().optional(),
  depends: z.array(z.string()).optional(),
  mcp: z.string().optional(),
  params: z.object({}).passthrough().optional(),
  schema: z.object({}).passthrough().optional(),
});

export const relayWorkflowValidateSchema = z.object({
  steps: z.array(workflowStepSchema).describe('Steps to validate (same format as relay_workflow_run)'),
});

export type RelayWorkflowValidateInput = z.infer<typeof relayWorkflowValidateSchema>;

export interface ValidationError {
  step: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  step: string;
  message: string;
}

export interface RelayWorkflowValidateResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  structure: {
    totalSteps: number;
    executionOrder: string[];
    parallelGroups: string[][];
  };
}

/**
 * Validate model ID format
 */
function isValidModelFormat(model: string): boolean {
  const parts = model.split(':');
  if (parts.length !== 2) return false;

  const [provider, modelId] = parts;
  const validProviders = ['openai', 'anthropic', 'google', 'xai', 'local'];

  return validProviders.includes(provider) && modelId.length > 0;
}

/**
 * Check if model is known (has pricing)
 */
function isKnownModel(model: string): boolean {
  return model in PRICING;
}

/**
 * Topological sort with cycle detection
 */
function topologicalSort(
  steps: Array<{ name: string; depends?: string[] }>
): { order: string[]; hasCycle: boolean; cycleStep?: string } {
  const stepNames = new Set(steps.map(s => s.name));
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  let cycleStep: string | undefined;

  function visit(stepName: string): boolean {
    if (visited.has(stepName)) return true;
    if (visiting.has(stepName)) {
      cycleStep = stepName;
      return false;
    }

    visiting.add(stepName);

    const step = steps.find(s => s.name === stepName);
    if (step?.depends) {
      for (const dep of step.depends) {
        if (!visit(dep)) return false;
      }
    }

    visiting.delete(stepName);
    visited.add(stepName);
    order.push(stepName);
    return true;
  }

  for (const step of steps) {
    if (!visit(step.name)) {
      return { order: [], hasCycle: true, cycleStep };
    }
  }

  return { order, hasCycle: false };
}

/**
 * Calculate parallel execution groups
 */
function calculateParallelGroups(
  steps: Array<{ name: string; depends?: string[] }>
): string[][] {
  const stepMap = new Map(steps.map(s => [s.name, s]));
  const levels = new Map<string, number>();

  function getLevel(stepName: string): number {
    if (levels.has(stepName)) return levels.get(stepName)!;

    const step = stepMap.get(stepName);
    if (!step?.depends?.length) {
      levels.set(stepName, 0);
      return 0;
    }

    const maxDepLevel = Math.max(...step.depends.map(d => getLevel(d)));
    const level = maxDepLevel + 1;
    levels.set(stepName, level);
    return level;
  }

  // Calculate levels for all steps
  for (const step of steps) {
    getLevel(step.name);
  }

  // Group by level
  const groups: string[][] = [];
  const maxLevel = Math.max(...levels.values(), -1);

  for (let i = 0; i <= maxLevel; i++) {
    const group: string[] = [];
    for (const [name, level] of levels) {
      if (level === i) group.push(name);
    }
    if (group.length > 0) groups.push(group);
  }

  return groups;
}

export async function relayWorkflowValidate(
  input: RelayWorkflowValidateInput
): Promise<RelayWorkflowValidateResponse> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stepNames = new Set(input.steps.map(s => s.name));

  // Check for duplicate step names
  const nameCount = new Map<string, number>();
  for (const step of input.steps) {
    nameCount.set(step.name, (nameCount.get(step.name) || 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      errors.push({
        step: name,
        field: 'name',
        message: `Duplicate step name: "${name}" appears ${count} times`,
      });
    }
  }

  // Validate each step
  for (const step of input.steps) {
    // Check step name
    if (!step.name || step.name.trim() === '') {
      errors.push({
        step: '(unnamed)',
        field: 'name',
        message: 'Step name is required',
      });
      continue;
    }

    // Check for valid step configuration
    const hasModel = !!step.model;
    const hasPrompt = !!step.prompt;
    const hasMcp = !!step.mcp;

    if (hasModel && !hasPrompt) {
      errors.push({
        step: step.name,
        field: 'prompt',
        message: 'Steps with a model must have a prompt',
      });
    }

    if (hasPrompt && !hasModel) {
      errors.push({
        step: step.name,
        field: 'model',
        message: 'Steps with a prompt must have a model',
      });
    }

    if (!hasModel && !hasMcp) {
      warnings.push({
        step: step.name,
        message: 'Step has no model or MCP tool - it will be a pass-through step',
      });
    }

    // Validate model format
    if (hasModel) {
      if (!isValidModelFormat(step.model!)) {
        errors.push({
          step: step.name,
          field: 'model',
          message: `Invalid model format: "${step.model}". Expected "provider:model-id" (e.g., "openai:gpt-4o")`,
        });
      } else if (!isKnownModel(step.model!)) {
        warnings.push({
          step: step.name,
          message: `Unknown model "${step.model}" - using default pricing estimate`,
        });
      }
    }

    // Validate MCP format
    if (hasMcp) {
      const parts = step.mcp!.split(':');
      if (parts.length !== 2) {
        errors.push({
          step: step.name,
          field: 'mcp',
          message: `Invalid MCP tool format: "${step.mcp}". Expected "server:tool" (e.g., "crm:search")`,
        });
      }
    }

    // Validate dependencies exist
    if (step.depends) {
      for (const dep of step.depends) {
        if (!stepNames.has(dep)) {
          errors.push({
            step: step.name,
            field: 'depends',
            message: `Dependency "${dep}" not found in workflow steps`,
          });
        }
        if (dep === step.name) {
          errors.push({
            step: step.name,
            field: 'depends',
            message: 'Step cannot depend on itself',
          });
        }
      }
    }
  }

  // Check for cycles
  const { order, hasCycle, cycleStep } = topologicalSort(input.steps);

  if (hasCycle) {
    errors.push({
      step: cycleStep || '(unknown)',
      field: 'depends',
      message: `Circular dependency detected involving step: ${cycleStep}`,
    });
  }

  // Calculate parallel groups
  const parallelGroups = hasCycle ? [] : calculateParallelGroups(input.steps);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    structure: {
      totalSteps: input.steps.length,
      executionOrder: hasCycle ? [] : order,
      parallelGroups,
    },
  };
}

export const relayWorkflowValidateDefinition = {
  name: 'relay_workflow_validate',
  description:
    'Validate workflow structure without making any LLM calls (free). Checks DAG structure (no cycles), dependency references, and model ID format. Does NOT validate schema compatibility between steps or prompt effectiveness - use relay_workflow_run for full validation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      steps: {
        type: 'array',
        description: 'Steps to validate (same format as relay_workflow_run)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            model: { type: 'string' },
            prompt: { type: 'string' },
            systemPrompt: { type: 'string' },
            depends: { type: 'array', items: { type: 'string' } },
            mcp: { type: 'string' },
            params: { type: 'object' },
            schema: { type: 'object' },
          },
          required: ['name'],
        },
      },
    },
    required: ['steps'],
  },
};
