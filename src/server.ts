/**
 * RelayPlane MCP Server
 *
 * Provides MCP tools for efficient AI workflow orchestration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig } from './config.js';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_RESOURCE } from './prompts/system-prompt.js';

// Import tools
import {
  relayModelsList,
  relayModelsListDefinition,
  relayModelsListSchema,
} from './tools/relay-models-list.js';
import {
  relayRun,
  relayRunDefinition,
  relayRunSchema,
} from './tools/relay-run.js';
import {
  relayWorkflowRun,
  relayWorkflowRunDefinition,
  relayWorkflowRunSchema,
} from './tools/relay-workflow-run.js';
import {
  relayWorkflowValidate,
  relayWorkflowValidateDefinition,
  relayWorkflowValidateSchema,
} from './tools/relay-workflow-validate.js';
import {
  relaySkillsList,
  relaySkillsListDefinition,
  relaySkillsListSchema,
} from './tools/relay-skills-list.js';
import {
  relayRunsList,
  relayRunsListDefinition,
  relayRunsListSchema,
} from './tools/relay-runs-list.js';
import {
  relayRunGet,
  relayRunGetDefinition,
  relayRunGetSchema,
} from './tools/relay-run-get.js';

// Tool definitions
const TOOLS = [
  relayModelsListDefinition,
  relayRunDefinition,
  relayWorkflowRunDefinition,
  relayWorkflowValidateDefinition,
  relaySkillsListDefinition,
  relayRunsListDefinition,
  relayRunGetDefinition,
];

// Prompt definitions
const PROMPTS = [
  {
    name: 'relayplane-system',
    description: 'System prompt for AI agents using RelayPlane MCP tools',
    arguments: [],
  },
];

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: '@relayplane/mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: any;

      switch (name) {
        case 'relay_models_list': {
          const parsed = relayModelsListSchema.parse(args || {});
          result = await relayModelsList(parsed);
          break;
        }
        case 'relay_run': {
          const parsed = relayRunSchema.parse(args);
          result = await relayRun(parsed);
          break;
        }
        case 'relay_workflow_run': {
          const parsed = relayWorkflowRunSchema.parse(args);
          result = await relayWorkflowRun(parsed);
          break;
        }
        case 'relay_workflow_validate': {
          const parsed = relayWorkflowValidateSchema.parse(args);
          result = await relayWorkflowValidate(parsed);
          break;
        }
        case 'relay_skills_list': {
          const parsed = relaySkillsListSchema.parse(args || {});
          result = await relaySkillsList(parsed);
          break;
        }
        case 'relay_runs_list': {
          const parsed = relayRunsListSchema.parse(args || {});
          result = await relayRunsList(parsed);
          break;
        }
        case 'relay_run_get': {
          const parsed = relayRunGetSchema.parse(args);
          result = await relayRunGet(parsed);
          break;
        }
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
    }
  });

  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: PROMPTS };
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === 'relayplane-system') {
      return {
        description: 'System prompt for AI agents using RelayPlane MCP tools',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: SYSTEM_PROMPT,
            },
          },
        ],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  });

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr to avoid interfering with stdio communication
  console.error('RelayPlane MCP Server started');
  console.error(`Config: ${JSON.stringify(getConfig(), null, 2)}`);
}
