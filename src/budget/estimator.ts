/**
 * Cost Estimator
 *
 * Estimates provider costs (OpenAI, Anthropic, etc.)
 * RelayPlane is BYOK - we don't charge for API usage.
 * This protects users from runaway provider bills.
 */

// Pricing per 1k tokens (as of Dec 2024)
export const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'openai:gpt-4o': { input: 0.0025, output: 0.01 },
  'openai:gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'openai:gpt-4-turbo': { input: 0.01, output: 0.03 },
  'openai:gpt-4': { input: 0.03, output: 0.06 },
  'openai:gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'openai:o1': { input: 0.015, output: 0.06 },
  'openai:o1-mini': { input: 0.003, output: 0.012 },
  'openai:o1-preview': { input: 0.015, output: 0.06 },

  // Anthropic
  'anthropic:claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'anthropic:claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
  'anthropic:claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  'anthropic:claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
  'anthropic:claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'anthropic:claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'anthropic:claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },

  // Google
  'google:gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'google:gemini-2.0-flash-exp': { input: 0.0001, output: 0.0004 },
  'google:gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'google:gemini-1.5-flash': { input: 0.000075, output: 0.0003 },

  // xAI
  'xai:grok-2': { input: 0.002, output: 0.01 },
  'xai:grok-beta': { input: 0.005, output: 0.015 },
};

// Conservative default for unknown models
const DEFAULT_PRICING = { input: 0.01, output: 0.03 };

/**
 * Rough estimate: ~4 chars per token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate provider cost for a single call
 */
export function estimateProviderCost(
  model: string,
  prompt: string,
  systemPrompt?: string,
  estimatedOutputTokens: number = 500
): number {
  const inputText = (systemPrompt || '') + prompt;
  const inputTokens = estimateTokens(inputText);

  const pricing = PRICING[model] || DEFAULT_PRICING;

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate actual cost from token counts
 */
export function calculateActualCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = PRICING[model] || DEFAULT_PRICING;

  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Estimate workflow cost (sum of all steps)
 */
export function estimateWorkflowCost(
  steps: Array<{ model?: string; prompt?: string; systemPrompt?: string }>
): number {
  let total = 0;

  for (const step of steps) {
    if (step.model && step.prompt) {
      total += estimateProviderCost(step.model, step.prompt, step.systemPrompt);
    }
  }

  return total;
}

/**
 * Get pricing info for a model
 */
export function getModelPricing(model: string): { input: number; output: number } {
  return PRICING[model] || DEFAULT_PRICING;
}
