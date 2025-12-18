/**
 * Multi-Step Workflow API
 */

export interface WorkflowStep {
  name: string;
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  depends?: string[];
  mcp?: string;
  params?: Record<string, any>;
  schema?: object;
}

export interface WorkflowInput {
  name: string;
  steps: WorkflowStep[];
  input: Record<string, any>;
}

export interface WorkflowResponse {
  success: boolean;
  steps: Record<string, { output: any; durationMs: number }>;
  finalOutput: any;
  totalUsage: { totalTokens: number; estimatedProviderCostUsd: number };
  runId: string;
  traceUrl: string;
  contextReduction: string;
}

/**
 * Execute a multi-step AI workflow.
 *
 * **90%+ context reduction:** Intermediate results stay in the workflow engine,
 * not your context. Only the final result returns to you.
 *
 * Cost tracks your provider bills (OpenAI/Anthropic), not RelayPlane fees — we're BYOK.
 *
 * @example
 * const result = await workflow({
 *   name: "extract-and-validate",
 *   steps: [
 *     { name: "extract", model: "openai:gpt-4o", prompt: "Extract invoice data..." },
 *     { name: "validate", model: "anthropic:claude-3-5-sonnet-20241022", depends: ["extract"], prompt: "Validate..." }
 *   ],
 *   input: { fileUrl: "https://..." }
 * });
 */
export async function workflow(input: WorkflowInput): Promise<WorkflowResponse> {
  // This function is a placeholder for MCP tool call
  // In actual usage, this would be called via the MCP client
  throw new Error(
    'workflow() must be called via MCP client. ' +
    'Use the relay_workflow_run tool through your MCP-enabled AI assistant.'
  );
}
