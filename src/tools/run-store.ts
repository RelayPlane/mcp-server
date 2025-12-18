/**
 * Run Store
 *
 * In-memory storage for run history.
 * In production, this would be backed by a database.
 */

export interface RunRecord {
  runId: string;
  type: 'single' | 'workflow';
  model?: string;
  workflowName?: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
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
  contextReduction?: string;
}

// In-memory store (max 100 runs)
const MAX_RUNS = 100;
let runs: RunRecord[] = [];

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `run_${timestamp}_${random}`;
}

/**
 * Add a run to the store
 */
export function addRun(run: RunRecord): void {
  runs.unshift(run); // Add to beginning

  // Trim to max size
  if (runs.length > MAX_RUNS) {
    runs = runs.slice(0, MAX_RUNS);
  }
}

/**
 * Get recent runs
 */
export function getRecentRuns(limit: number = 10): RunRecord[] {
  return runs.slice(0, Math.min(limit, 50));
}

/**
 * Get a specific run by ID
 */
export function getRunById(runId: string): RunRecord | undefined {
  return runs.find(r => r.runId === runId);
}

/**
 * Clear all runs (for testing)
 */
export function clearRuns(): void {
  runs = [];
}
