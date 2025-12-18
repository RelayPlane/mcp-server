/**
 * relay_models_list Tool
 *
 * Lists available AI models with capabilities and pricing.
 */

import { z } from 'zod';
import { PRICING } from '../budget/estimator.js';
import { isProviderConfigured } from '../config.js';

export const relayModelsListSchema = z.object({
  provider: z
    .enum(['openai', 'anthropic', 'google', 'xai', 'all'])
    .optional()
    .describe('Filter by provider'),
});

export type RelayModelsListInput = z.infer<typeof relayModelsListSchema>;

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  capabilities: string[];
  contextWindow: number;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  configured: boolean;
}

// Model metadata
const MODEL_METADATA: Record<string, Omit<ModelInfo, 'id' | 'provider' | 'inputCostPer1kTokens' | 'outputCostPer1kTokens' | 'configured'>> = {
  // OpenAI
  'openai:gpt-4o': {
    name: 'GPT-4o',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode'],
    contextWindow: 128000,
  },
  'openai:gpt-4o-mini': {
    name: 'GPT-4o Mini',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode'],
    contextWindow: 128000,
  },
  'openai:gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode'],
    contextWindow: 128000,
  },
  'openai:o1': {
    name: 'O1',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 200000,
  },
  'openai:o1-mini': {
    name: 'O1 Mini',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 128000,
  },
  'openai:o1-preview': {
    name: 'O1 Preview',
    capabilities: ['chat', 'reasoning'],
    contextWindow: 128000,
  },
  'openai:gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    capabilities: ['chat', 'function-calling', 'json-mode'],
    contextWindow: 16385,
  },

  // Anthropic
  'anthropic:claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    capabilities: ['chat', 'vision', 'function-calling', 'computer-use'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-5-sonnet-latest': {
    name: 'Claude 3.5 Sonnet (Latest)',
    capabilities: ['chat', 'vision', 'function-calling', 'computer-use'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-5-haiku-20241022': {
    name: 'Claude 3.5 Haiku',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-5-haiku-latest': {
    name: 'Claude 3.5 Haiku (Latest)',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-sonnet-20240229': {
    name: 'Claude 3 Sonnet',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 200000,
  },
  'anthropic:claude-3-haiku-20240307': {
    name: 'Claude 3 Haiku',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 200000,
  },

  // Google
  'google:gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    capabilities: ['chat', 'vision', 'function-calling', 'code-execution'],
    contextWindow: 1000000,
  },
  'google:gemini-2.0-flash-exp': {
    name: 'Gemini 2.0 Flash (Experimental)',
    capabilities: ['chat', 'vision', 'function-calling', 'code-execution'],
    contextWindow: 1000000,
  },
  'google:gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    capabilities: ['chat', 'vision', 'function-calling', 'code-execution'],
    contextWindow: 2000000,
  },
  'google:gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    capabilities: ['chat', 'vision', 'function-calling'],
    contextWindow: 1000000,
  },

  // xAI
  'xai:grok-2': {
    name: 'Grok 2',
    capabilities: ['chat', 'function-calling'],
    contextWindow: 131072,
  },
  'xai:grok-beta': {
    name: 'Grok Beta',
    capabilities: ['chat', 'function-calling'],
    contextWindow: 131072,
  },
};

export interface RelayModelsListResponse {
  models: ModelInfo[];
}

export async function relayModelsList(
  input: RelayModelsListInput
): Promise<RelayModelsListResponse> {
  const models: ModelInfo[] = [];

  for (const [modelId, pricing] of Object.entries(PRICING)) {
    const [provider] = modelId.split(':');
    const metadata = MODEL_METADATA[modelId];

    // Filter by provider if specified
    if (input.provider && input.provider !== 'all' && provider !== input.provider) {
      continue;
    }

    if (metadata) {
      models.push({
        id: modelId,
        provider,
        name: metadata.name,
        capabilities: metadata.capabilities,
        contextWindow: metadata.contextWindow,
        inputCostPer1kTokens: pricing.input,
        outputCostPer1kTokens: pricing.output,
        configured: isProviderConfigured(provider),
      });
    }
  }

  // Sort by provider, then by name
  models.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  return { models };
}

export const relayModelsListDefinition = {
  name: 'relay_models_list',
  description:
    'List available AI models with capabilities and pricing. Use to check valid model IDs before testing. Cost shows provider pricing (OpenAI/Anthropic) - RelayPlane is BYOK, we don\'t charge for API usage.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic', 'google', 'xai', 'all'],
        description: 'Filter by provider (optional)',
      },
    },
  },
};
