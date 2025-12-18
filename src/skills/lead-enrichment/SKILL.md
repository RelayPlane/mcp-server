# Lead Enrichment

Enrich lead data with company info, social profiles, and qualification scores.

## Context Efficiency

| Approach | Tokens Through Context |
|----------|------------------------|
| Direct tool calls | ~10,000 |
| This skill | ~1,000 |
| **Reduction** | **90%** |

Lookup results and analysis stay in the workflow engine.
Only the final enriched lead data enters your context.

## Usage

```typescript
import { relay } from "@relayplane/sdk";

const result = await relay
  .workflow("lead-enrichment")
  .step("lookup")
    .mcp("clearbit:lookup")
    .params({ email: "{{input.email}}" })
  .step("analyze")
    .with("anthropic:claude-3-5-haiku-20241022")
    .depends("lookup")
    .prompt("Score this lead based on enriched data...")
  .step("format")
    .with("openai:gpt-4o-mini")
    .depends("analyze")
    .prompt("Format for CRM import...")
  .run({ email: "john@acmecorp.com", name: "John Smith" });

console.log(result.finalOutput); // CRM-ready lead data
```

## Models Used

| Step | Model | Why |
|------|-------|-----|
| Lookup | MCP tool (Clearbit, etc.) | Real-time data enrichment |
| Analyze | anthropic:claude-3-5-haiku-20241022 | Fast, cost-effective analysis |
| Format | openai:gpt-4o-mini | Structured JSON output |

## Estimated Cost

~$0.01-0.03 per lead (provider costs only, RelayPlane is BYOK)

## Output Schema

```typescript
interface EnrichedLead {
  contact: {
    email: string;
    name: string;
    title: string;
  };
  company: {
    name: string;
    domain: string;
    industry: string;
    size: string;
  };
  qualification: {
    score: number; // 1-100
    tier: 'Hot' | 'Warm' | 'Cold';
    signals: string[];
  };
  nextAction: string;
  notes: string;
}
```

## Integration Note

For production use, replace the lookup step with actual MCP tools like:
- `clearbit:lookup` - Company and person data
- `linkedin:profile` - Professional profile
- `crunchbase:company` - Funding and company info
