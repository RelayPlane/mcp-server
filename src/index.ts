#!/usr/bin/env node
/**
 * RelayPlane MCP Server
 *
 * MCP server for efficient AI workflow orchestration with RelayPlane.
 *
 * Usage:
 *   claude mcp add relayplane -- npx @relayplane/mcp-server
 *   claude mcp add relayplane -- npx @relayplane/mcp-server --out-dir ./src/lib/relayplane
 *   claude mcp add relayplane -- npx @relayplane/mcp-server --max-daily-cost 10
 */

import { initConfig } from './config.js';
import { startServer } from './server.js';
import { generateCodeAPI } from './codegen/generate-api.js';

async function main() {
  // Initialize configuration from CLI args and environment
  const config = initConfig();

  // Generate code API files if configured
  if (config.codegenOutDir) {
    try {
      await generateCodeAPI(config.codegenOutDir);
      console.error(`Generated code API at: ${config.codegenOutDir}`);
    } catch (error) {
      console.error(`Warning: Failed to generate code API: ${error}`);
      // Don't fail startup - code generation is optional
    }
  }

  // Start the MCP server
  await startServer();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
