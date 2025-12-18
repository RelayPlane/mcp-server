/**
 * Single Model Call API
 */

export interface RunInput {
  model: string;
  prompt: string;
  systemPrompt?: string;
  schema?: object;
}

export interface RunResponse {
  success: boolean;
  output: string | object;
  usage: {
    promptTokens: number;
    completionTokens: number;
    estimatedProviderCostUsd: number;
  };
  durationMs: number;
  runId: string;
  traceUrl: string;
}

/**
 * Execute a single AI model call.
 *
 * Cost tracks your provider bill (OpenAI/Anthropic), not RelayPlane fees — we're BYOK.
 *
 * @example
 * const result = await run({
 *   model: "openai:gpt-4o",
 *   prompt: "Summarize this document..."
 * });
 * console.log(result.output);
 */
export async function run(input: RunInput): Promise<RunResponse> {
  // This function is a placeholder for MCP tool call
  // In actual usage, this would be called via the MCP client
  throw new Error(
    'run() must be called via MCP client. ' +
    'Use the relay_run tool through your MCP-enabled AI assistant.'
  );
}
