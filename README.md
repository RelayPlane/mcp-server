# @relayplane/mcp-server

MCP server for efficient AI workflow orchestration with RelayPlane.

## Why RelayPlane?

**90%+ context reduction on multi-step pipelines.**

When AI agents use MCP tools directly, they face two problems:
1. **Tool definitions bloat context** — 100k+ tokens for many tools
2. **Intermediate results pass through context** — a 50k token document copied between steps

RelayPlane workflows solve this by keeping intermediate results in the workflow engine, not your context window.

## Installation

```bash
# Add to Claude Code
claude mcp add relayplane -- npx @relayplane/mcp-server

# With custom output directory for generated code
claude mcp add relayplane -- npx @relayplane/mcp-server --out-dir ./src/lib/relayplane

# With budget override
claude mcp add relayplane -- npx @relayplane/mcp-server --max-daily-cost 10
```

## Environment Variables

Set your provider API keys:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
export XAI_API_KEY=...
```

## Available Tools

| Tool | Purpose | Cost |
|------|---------|------|
| `relay_run` | Test single prompt | Provider cost |
| `relay_workflow_run` | Test multi-step workflow | Provider cost |
| `relay_models_list` | List available models | Free |
| `relay_workflow_validate` | Validate DAG structure (no LLM calls) | Free |
| `relay_skills_list` | Discover pre-built skills | Free |
| `relay_runs_list` | List recent runs | Free |
| `relay_run_get` | Get run details + trace URL | Free |

## Usage Example

```typescript
// Single model call
const result = await relay_run({
  model: "openai:gpt-4o",
  prompt: "Summarize this document...",
  systemPrompt: "You are a helpful assistant."
});

// Multi-step workflow
const workflow = await relay_workflow_run({
  name: "extract-and-validate",
  steps: [
    {
      name: "extract",
      model: "openai:gpt-4o",
      prompt: "Extract all invoice fields from: {{input.document}}"
    },
    {
      name: "validate",
      model: "anthropic:claude-3-5-sonnet-20241022",
      depends: ["extract"],
      prompt: "Validate the extracted data: {{steps.extract.output}}"
    }
  ],
  input: {
    document: "Invoice #123..."
  }
});

console.log(workflow.contextReduction); // "94% (saved ~12k tokens)"
```

## Budget Limits

Budget tracking protects you from runaway **provider costs** (OpenAI, Anthropic bills).
RelayPlane is BYOK — we don't charge for API usage.

Default limits:
- Daily: $5.00
- Single call: $0.50
- Calls per hour: 100

Override with CLI flags:
```bash
--max-daily-cost 10
--max-single-call-cost 1
--max-calls-per-hour 200
```

## Pre-built Skills

Discover pre-built workflow patterns:

```
relay_skills_list({ category: "extraction" })
```

Available skills:
- **invoice-processor** - Extract, validate, summarize invoices (97% context reduction)
- **content-pipeline** - Research, draft, refine content (85% context reduction)
- **lead-enrichment** - Enrich and score leads (90% context reduction)
- **document-qa** - RAG-based document Q&A (75% context reduction)
- **code-review** - Multi-stage code review (80% context reduction)
- **email-classifier** - Classify and route emails (95% context reduction)

## Configuration

Create `~/.relayplane/mcp-config.json`:

```json
{
  "codegenOutDir": "./servers/relayplane",
  "maxDailyCostUsd": 5.00,
  "maxSingleCallCostUsd": 0.50,
  "maxCallsPerHour": 100,
  "providers": {
    "openai": { "apiKey": "${OPENAI_API_KEY}" },
    "anthropic": { "apiKey": "${ANTHROPIC_API_KEY}" }
  }
}
```

## Development

```bash
# Build
pnpm build

# Run locally
pnpm dev

# Test
pnpm test
```

## License

MIT
