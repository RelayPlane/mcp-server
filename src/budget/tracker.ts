/**
 * Budget Tracker
 *
 * Tracks estimated provider costs (OpenAI, Anthropic, etc.)
 * RelayPlane is BYOK - we don't charge for API usage.
 * This protects users from runaway provider bills.
 */

import { getConfig } from '../config.js';

interface BudgetState {
  dailySpendUsd: number;
  hourlyCallCount: number;
  lastResetDate: string; // YYYY-MM-DD UTC
  lastHourlyReset: string; // ISO timestamp
}

// In-memory state (resets on server restart)
let budgetState: BudgetState = {
  dailySpendUsd: 0,
  hourlyCallCount: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  lastHourlyReset: new Date().toISOString(),
};

/**
 * Get current UTC date string
 */
function getCurrentDateUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if hourly reset is needed (1 hour passed)
 */
function shouldResetHourly(): boolean {
  const lastReset = new Date(budgetState.lastHourlyReset);
  const now = new Date();
  const hourInMs = 60 * 60 * 1000;
  return (now.getTime() - lastReset.getTime()) >= hourInMs;
}

/**
 * Reset counters if needed
 */
function maybeResetCounters(): void {
  const currentDate = getCurrentDateUTC();

  // Daily reset at midnight UTC
  if (budgetState.lastResetDate !== currentDate) {
    budgetState.dailySpendUsd = 0;
    budgetState.lastResetDate = currentDate;
  }

  // Hourly reset for call count
  if (shouldResetHourly()) {
    budgetState.hourlyCallCount = 0;
    budgetState.lastHourlyReset = new Date().toISOString();
  }
}

export interface BudgetCheckResult {
  allowed: boolean;
  error?: string;
  currentDailySpend: number;
  currentHourlyCalls: number;
}

/**
 * Check if a call is allowed within budget limits
 */
export function checkBudget(estimatedCost: number): BudgetCheckResult {
  maybeResetCounters();

  const config = getConfig();

  // Check hourly call limit
  if (budgetState.hourlyCallCount >= config.maxCallsPerHour) {
    return {
      allowed: false,
      error: `Hourly call limit reached (${config.maxCallsPerHour} calls). ` +
        `Use relay_workflow_validate (free) for syntax checks, or wait for reset.`,
      currentDailySpend: budgetState.dailySpendUsd,
      currentHourlyCalls: budgetState.hourlyCallCount,
    };
  }

  // Check daily budget
  if (budgetState.dailySpendUsd + estimatedCost > config.maxDailyCostUsd) {
    return {
      allowed: false,
      error: `Daily provider budget exceeded. ` +
        `Estimated spend: $${budgetState.dailySpendUsd.toFixed(2)} / $${config.maxDailyCostUsd}. ` +
        `This tracks your OpenAI/Anthropic bills, not RelayPlane fees (we're BYOK). ` +
        `Resets at midnight UTC. Use relay_workflow_validate (free) for syntax checks.`,
      currentDailySpend: budgetState.dailySpendUsd,
      currentHourlyCalls: budgetState.hourlyCallCount,
    };
  }

  // Check single call limit
  if (estimatedCost > config.maxSingleCallCostUsd) {
    return {
      allowed: false,
      error: `Estimated provider cost ($${estimatedCost.toFixed(2)}) exceeds single-call limit ($${config.maxSingleCallCostUsd}). ` +
        `Try a smaller model (gpt-4o-mini) or shorter prompt.`,
      currentDailySpend: budgetState.dailySpendUsd,
      currentHourlyCalls: budgetState.hourlyCallCount,
    };
  }

  return {
    allowed: true,
    currentDailySpend: budgetState.dailySpendUsd,
    currentHourlyCalls: budgetState.hourlyCallCount,
  };
}

/**
 * Record a completed call's cost
 */
export function recordCost(actualCost: number): void {
  maybeResetCounters();
  budgetState.dailySpendUsd += actualCost;
  budgetState.hourlyCallCount++;
}

/**
 * Get current budget state
 */
export function getBudgetState(): BudgetState {
  maybeResetCounters();
  return { ...budgetState };
}

/**
 * Reset budget state (for testing)
 */
export function resetBudgetState(): void {
  budgetState = {
    dailySpendUsd: 0,
    hourlyCallCount: 0,
    lastResetDate: getCurrentDateUTC(),
    lastHourlyReset: new Date().toISOString(),
  };
}
