/**
 * MCP Server Configuration
 *
 * Handles CLI flags, environment variables, and configuration file loading.
 */

export interface McpServerConfig {
  // Code generation
  codegenOutDir: string;

  // Budget (tracks provider costs, not RelayPlane fees - we're BYOK)
  maxDailyCostUsd: number;
  maxSingleCallCostUsd: number;
  maxCallsPerHour: number;

  // Execution
  defaultTimeoutMs: number;
  maxConcurrentRuns: number;

  // Providers
  providers: {
    openai?: { apiKey: string };
    anthropic?: { apiKey: string };
    google?: { apiKey: string };
    xai?: { apiKey: string };
  };

  // Trace URL base
  traceUrlBase: string;
}

const DEFAULT_CONFIG: McpServerConfig = {
  codegenOutDir: './servers/relayplane',
  maxDailyCostUsd: 5.00,
  maxSingleCallCostUsd: 0.50,
  maxCallsPerHour: 100,
  defaultTimeoutMs: 30000,
  maxConcurrentRuns: 3,
  providers: {},
  traceUrlBase: 'https://app.relayplane.com/runs',
};

let currentConfig: McpServerConfig = { ...DEFAULT_CONFIG };

/**
 * Parse CLI arguments
 */
export function parseCliArgs(args: string[]): Partial<McpServerConfig> {
  const config: Partial<McpServerConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--out-dir' && args[i + 1]) {
      config.codegenOutDir = args[++i];
    } else if (arg === '--max-daily-cost' && args[i + 1]) {
      config.maxDailyCostUsd = parseFloat(args[++i]);
    } else if (arg === '--max-single-call-cost' && args[i + 1]) {
      config.maxSingleCallCostUsd = parseFloat(args[++i]);
    } else if (arg === '--max-calls-per-hour' && args[i + 1]) {
      config.maxCallsPerHour = parseInt(args[++i], 10);
    } else if (arg === '--timeout' && args[i + 1]) {
      config.defaultTimeoutMs = parseInt(args[++i], 10);
    }
  }

  return config;
}

/**
 * Load provider keys from environment variables
 */
export function loadProvidersFromEnv(): McpServerConfig['providers'] {
  const providers: McpServerConfig['providers'] = {};

  if (process.env.OPENAI_API_KEY) {
    providers.openai = { apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = { apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.GOOGLE_API_KEY) {
    providers.google = { apiKey: process.env.GOOGLE_API_KEY };
  }
  if (process.env.XAI_API_KEY) {
    providers.xai = { apiKey: process.env.XAI_API_KEY };
  }

  return providers;
}

/**
 * Initialize configuration from CLI args and environment
 */
export function initConfig(cliArgs: string[] = process.argv.slice(2)): McpServerConfig {
  const cliConfig = parseCliArgs(cliArgs);
  const providers = loadProvidersFromEnv();

  currentConfig = {
    ...DEFAULT_CONFIG,
    ...cliConfig,
    providers: { ...DEFAULT_CONFIG.providers, ...providers },
  };

  return currentConfig;
}

/**
 * Get current configuration
 */
export function getConfig(): McpServerConfig {
  return currentConfig;
}

/**
 * Get provider API key
 */
export function getProviderKey(provider: string): string | undefined {
  const providers = currentConfig.providers as Record<string, { apiKey: string } | undefined>;
  return providers[provider]?.apiKey;
}

/**
 * Check if provider is configured
 */
export function isProviderConfigured(provider: string): boolean {
  return !!getProviderKey(provider);
}
