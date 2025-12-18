# RelayPlane MCP Server

> Reduce AI context usage by 90%+ in multi-step workflows

RelayPlane keeps intermediate results in the workflow engine instead of passing them through your context window—saving tokens and reducing costs.

## Table of Contents
- [Quick Start](#quick-start)
- [Installation Options](#installation-options)
- [Model IDs](#model-ids)
- [Available Tools](#available-tools)
- [Budget Protection](#budget-protection)
- [Pre-built Skills](#pre-built-skills)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install with API Keys (Recommended)

```bash
claude mcp add relayplane \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -- npx @relayplane/mcp-server
```

### 2. Restart Claude Code

**Important:** You must fully restart Claude Code after adding the MCP server. The `/mcp` command only reconnects—it doesn't reload environment variables.

### 3. Test the Connection

Ask Claude: *"Use relay_models_list to show configured providers"*

Models should show `configured: true` for providers with valid API keys.

---

## Installation Options

### Option A: Inline API Keys (Simplest)

```bash
claude mcp add relayplane \
  -e OPENAI_API_KEY=sk-proj-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e GOOGLE_API_KEY=AIza... \
  -e XAI_API_KEY=xai-... \
  -- npx @relayplane/mcp-server
```

### Option B: Shell Environment Variables

First, add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export OPENAI_API_KEY=sk-proj-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=AIza...
export XAI_API_KEY=xai-...
```

Then source and install:

```bash
source ~/.zshrc
claude mcp add relayplane -- npx @relayplane/mcp-server
```

### Option C: Manual Configuration

Edit `~/.claude.json` directly:

```json
{
  "projects": {
    "/your/project/path": {
      "mcpServers": {
        "relayplane": {
          "type": "stdio",
          "command": "npx",
          "args": ["@relayplane/mcp-server"],
          "env": {
            "OPENAI_API_KEY": "sk-proj-...",
            "ANTHROPIC_API_KEY": "sk-ant-...",
            "GOOGLE_API_KEY": "AIza...",
            "XAI_API_KEY": "xai-..."
          }
        }
      }
    }
  }
}
```

> **Warning:** The `env` field must contain actual API keys, not variable references like `${OPENAI_API_KEY}`. Variable substitution is not supported in the MCP config file.

---

## Model IDs

> **Important:** Always check https://relayplane.com/docs/providers for the latest model IDs. The `relay_models_list` tool may return outdated information.

### OpenAI — prefix: `openai:`

| Model ID   | Best For                    |
|------------|-----------------------------|
| gpt-5.2    | Latest flagship, 1M context |
| gpt-5-mini | Cost-efficient, fast        |
| gpt-4.1    | Non-reasoning, 1M context   |
| o3         | Advanced reasoning          |
| o4-mini    | Fast reasoning              |

### Anthropic — prefix: `anthropic:`

| Model ID                   | Best For                          |
|----------------------------|-----------------------------------|
| claude-opus-4-5-20251101   | Most intelligent, complex tasks   |
| claude-sonnet-4-5-20250929 | Best coding, strongest for agents |
| claude-haiku-4-5-20251001  | Fast, high-volume tasks           |
| claude-3-5-haiku-20241022  | Fast, affordable (legacy)         |

### Google — prefix: `google:`

| Model ID         | Best For                 |
|------------------|--------------------------|
| gemini-3-pro     | Most powerful multimodal |
| gemini-2.5-flash | Fast multimodal          |
| gemini-2.0-flash | Cost-effective           |

### xAI — prefix: `xai:`

| Model ID    | Best For                      |
|-------------|-------------------------------|
| grok-4      | Latest flagship, 256K context |
| grok-3-mini | Fast, quick tasks             |

### Example Usage

```json
{
  "name": "my-step",
  "model": "openai:gpt-4.1",
  "prompt": "Analyze this data..."
}
```

---

## Available Tools

| Tool                    | Purpose                  | Cost      |
|-------------------------|--------------------------|-----------|
| relay_run               | Single prompt execution  | Per-token |
| relay_workflow_run      | Multi-step orchestration | Per-token |
| relay_workflow_validate | Validate DAG structure   | Free      |
| relay_skills_list       | List pre-built patterns  | Free      |
| relay_models_list       | List available models    | Free      |
| relay_runs_list         | View recent runs         | Free      |
| relay_run_get           | Get run details          | Free      |

---

## Budget Protection

Default safeguards (customizable via CLI flags):

| Limit           | Default | Flag                   |
|-----------------|---------|------------------------|
| Daily spending  | $5.00   | --max-daily-cost       |
| Per-call cost   | $0.50   | --max-single-call-cost |
| Hourly requests | 100     | --max-calls-per-hour   |

RelayPlane is BYOK (Bring Your Own Keys)—we don't charge for API usage. Costs reflect only your provider bills.

---

## Pre-built Skills

Use `relay_skills_list` to see available workflow templates:

| Skill             | Context Reduction | Use Case                              |
|-------------------|-------------------|---------------------------------------|
| invoice-processor | 97%               | Extract, validate, summarize invoices |
| content-pipeline  | 90%               | Generate and refine content           |
| lead-enrichment   | 80%               | Enrich contact data                   |

---

## Configuration

### Persistent Config File

Create `~/.relayplane/mcp-config.json`:

```json
{
  "codegenOutDir": "./servers/relayplane",
  "maxDailyCostUsd": 10.00,
  "maxSingleCallCostUsd": 1.00,
  "maxCallsPerHour": 200
}
```

> **Note:** API keys should be passed via environment variables or the Claude Code MCP `env` field—not stored in this config file.

---

## Troubleshooting

### "Provider not configured" Error

```
Provider "openai" (step "extract") is not configured.
Set OPENAI_API_KEY environment variable.
```

**Causes:**
1. API key not passed to MCP server
2. Claude Code not restarted after config change

**Solutions:**

1. Check your MCP config in `~/.claude.json`:
```json
"relayplane": {
  "env": {
    "OPENAI_API_KEY": "sk-..."  // Must be actual key, not ${VAR}
  }
}
```

2. Fully restart Claude Code (exit with `Ctrl+C`, relaunch)

3. Verify configuration:
   Ask Claude: *"Use relay_models_list and check which show configured: true"*

---

### Model Not Found (404 Error)

```
Anthropic API error: 404 - model: claude-3-5-sonnet-20241022
```

**Cause:** Model ID is outdated or incorrect.

**Solution:** Check current model IDs at:
https://relayplane.com/docs/providers

Common fixes:
- Use `claude-3-5-haiku-20241022` instead of `claude-3-5-sonnet-20241022`
- Use `gpt-4.1` instead of `gpt-4o` for latest OpenAI

---

### Config Changes Not Taking Effect

**Cause:** `/mcp` reconnect doesn't reload environment variables.

**Solution:** Fully restart Claude Code:
1. Exit with `Ctrl+C`
2. Relaunch `claude`
3. Run `/mcp` to verify connection

---

### Workflow Validation Passes But Execution Fails

**Cause:** `relay_workflow_validate` only checks DAG structure, not:
- API key validity
- Model availability
- Schema compatibility

**Solution:** Test with a simple `relay_run` first:
```
Use relay_run with model "openai:gpt-4.1" and prompt "Say hello"
```

---

## Quick Test

After setup, verify everything works:

```
Use relay_workflow_run to create an invoice processor:
- Step 1 (extract): Use openai:gpt-4.1 to extract vendor, total from invoice
- Step 2 (validate): Use anthropic:claude-3-5-haiku-20241022 to verify math

Input: "Invoice from Acme Corp, Total: $500"
```

Expected: Both steps complete successfully with structured output.

---

## Support

- **Documentation:** https://relayplane.com/docs
- **Model IDs:** https://relayplane.com/docs/providers
- **Issues:** https://github.com/RelayPlane/mcp-server/issues

---

## License

MIT
