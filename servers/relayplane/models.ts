/**
 * Models API
 */

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

export interface ModelsResponse {
  models: ModelInfo[];
}

/**
 * List available AI models with capabilities and pricing.
 *
 * Use to check valid model IDs before testing.
 *
 * @example
 * const { models } = await listModels({ provider: 'openai' });
 * console.log(models.map(m => m.id));
 */
export async function listModels(options?: { provider?: string }): Promise<ModelsResponse> {
  // This function is a placeholder for MCP tool call
  throw new Error(
    'listModels() must be called via MCP client. ' +
    'Use the relay_models_list tool through your MCP-enabled AI assistant.'
  );
}
