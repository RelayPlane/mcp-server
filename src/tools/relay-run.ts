/**
 * relay_run Tool
 *
 * Execute a single AI model call. Useful for testing prompts before building full workflows.
 */

import { z } from 'zod';
import { estimateProviderCost, calculateActualCost } from '../budget/estimator.js';
import { checkBudget, recordCost } from '../budget/tracker.js';
import { getConfig, getProviderKey, isProviderConfigured } from '../config.js';
import { addRun, generateRunId } from './run-store.js';

export const relayRunSchema = z.object({
  model: z
    .string()
    .describe("Model in provider:model format (e.g., 'openai:gpt-4o', 'anthropic:claude-3-5-sonnet-20241022')"),
  prompt: z.string().describe('The user prompt to send'),
  systemPrompt: z.string().optional().describe('Optional system prompt'),
  schema: z.object({}).passthrough().optional().describe('Optional JSON schema for structured output'),
});

export type RelayRunInput = z.infer<typeof relayRunSchema>;

export interface RelayRunResponse {
  success: boolean;
  output: string | object;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedProviderCostUsd: number;
  };
  durationMs: number;
  runId: string;
  traceUrl: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Parse provider:model format
 */
function parseModel(model: string): { provider: string; modelId: string } {
  const parts = model.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid model format: "${model}". Expected "provider:model-id" (e.g., "openai:gpt-4o")`);
  }
  return { provider: parts[0], modelId: parts[1] };
}

/**
 * Execute OpenAI model call
 */
async function executeOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  schema?: object
): Promise<{ output: any; promptTokens: number; completionTokens: number }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body: any = {
    model: modelId,
    messages,
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema,
      },
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content || '';

  let output: any = content;
  if (schema) {
    try {
      output = JSON.parse(content);
    } catch {
      output = content;
    }
  }

  return {
    output,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
  };
}

/**
 * Execute Anthropic model call
 */
async function executeAnthropic(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  schema?: object
): Promise<{ output: any; promptTokens: number; completionTokens: number }> {
  const body: any = {
    model: modelId,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    content: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content = data.content[0]?.text || '';

  let output: any = content;
  if (schema) {
    try {
      output = JSON.parse(content);
    } catch {
      output = content;
    }
  }

  return {
    output,
    promptTokens: data.usage?.input_tokens || 0,
    completionTokens: data.usage?.output_tokens || 0,
  };
}

/**
 * Execute Google model call
 */
async function executeGoogle(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemPrompt?: string
): Promise<{ output: any; promptTokens: number; completionTokens: number }> {
  const contents = [];

  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System: ${systemPrompt}\n\nUser: ${prompt}` }],
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    output: content,
    promptTokens: data.usageMetadata?.promptTokenCount || 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

/**
 * Execute xAI model call
 */
async function executeXAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemPrompt?: string
): Promise<{ output: any; promptTokens: number; completionTokens: number }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content || '';

  return {
    output: content,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
  };
}

export async function relayRun(input: RelayRunInput): Promise<RelayRunResponse> {
  const startTime = Date.now();
  const runId = generateRunId();
  const config = getConfig();

  try {
    // Parse model
    const { provider, modelId } = parseModel(input.model);

    // Check provider is configured
    if (!isProviderConfigured(provider)) {
      throw new Error(
        `Provider "${provider}" is not configured. Set ${provider.toUpperCase()}_API_KEY environment variable.`
      );
    }

    // Estimate cost and check budget
    const estimatedCost = estimateProviderCost(input.model, input.prompt, input.systemPrompt);
    const budgetCheck = checkBudget(estimatedCost);

    if (!budgetCheck.allowed) {
      throw new Error(budgetCheck.error);
    }

    // Get API key
    const apiKey = getProviderKey(provider)!;

    // Execute based on provider
    let result: { output: any; promptTokens: number; completionTokens: number };

    switch (provider) {
      case 'openai':
        result = await executeOpenAI(apiKey, modelId, input.prompt, input.systemPrompt, input.schema);
        break;
      case 'anthropic':
        result = await executeAnthropic(apiKey, modelId, input.prompt, input.systemPrompt, input.schema);
        break;
      case 'google':
        result = await executeGoogle(apiKey, modelId, input.prompt, input.systemPrompt);
        break;
      case 'xai':
        result = await executeXAI(apiKey, modelId, input.prompt, input.systemPrompt);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const durationMs = Date.now() - startTime;
    const actualCost = calculateActualCost(input.model, result.promptTokens, result.completionTokens);

    // Record actual cost
    recordCost(actualCost);

    const response: RelayRunResponse = {
      success: true,
      output: result.output,
      model: input.model,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.promptTokens + result.completionTokens,
        estimatedProviderCostUsd: actualCost,
      },
      durationMs,
      runId,
      traceUrl: `${config.traceUrlBase}/${runId}`,
    };

    // Store run
    addRun({
      runId,
      type: 'single',
      model: input.model,
      success: true,
      startTime: new Date(startTime),
      endTime: new Date(),
      durationMs,
      usage: response.usage,
      input: { prompt: input.prompt, systemPrompt: input.systemPrompt },
      output: result.output,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const response: RelayRunResponse = {
      success: false,
      output: '',
      model: input.model,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedProviderCostUsd: 0,
      },
      durationMs,
      runId,
      traceUrl: `${config.traceUrlBase}/${runId}`,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      },
    };

    // Store failed run
    addRun({
      runId,
      type: 'single',
      model: input.model,
      success: false,
      startTime: new Date(startTime),
      endTime: new Date(),
      durationMs,
      usage: response.usage,
      input: { prompt: input.prompt, systemPrompt: input.systemPrompt },
      error: errorMessage,
    });

    return response;
  }
}

export const relayRunDefinition = {
  name: 'relay_run',
  description:
    "Execute a single AI model call. Useful for testing prompts before building full workflows. Returns output, token usage, estimated provider cost, and trace URL. Note: Cost tracks your provider bill (OpenAI/Anthropic), not RelayPlane fees - we're BYOK.",
  inputSchema: {
    type: 'object' as const,
    properties: {
      model: {
        type: 'string',
        description: "Model in provider:model format (e.g., 'openai:gpt-4o', 'anthropic:claude-3-5-sonnet-20241022')",
      },
      prompt: {
        type: 'string',
        description: 'The user prompt to send',
      },
      systemPrompt: {
        type: 'string',
        description: 'Optional system prompt',
      },
      schema: {
        type: 'object',
        description: 'Optional JSON schema for structured output',
      },
    },
    required: ['model', 'prompt'],
  },
};
