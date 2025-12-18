# Content Pipeline

Research, draft, and refine content with multiple AI passes.

## Context Efficiency

| Approach | Tokens Through Context |
|----------|------------------------|
| Direct tool calls | ~20,000 |
| This skill | ~3,000 |
| **Reduction** | **85%** |

Research notes and drafts stay in the workflow engine.
Only the final polished content enters your context.

## Usage

```typescript
import { relay } from "@relayplane/sdk";

const result = await relay
  .workflow("content-pipeline")
  .step("research")
    .with("openai:gpt-4o")
    .prompt("Research topic: {{input.topic}} for {{input.audience}}...")
  .step("draft")
    .with("anthropic:claude-3-5-sonnet-20241022")
    .depends("research")
    .prompt("Write first draft based on research...")
  .step("refine")
    .with("openai:gpt-4o")
    .depends("draft")
    .prompt("Polish and finalize the content...")
  .run({
    topic: "AI in Healthcare",
    audience: "Healthcare executives",
    contentType: "blog post",
    tone: "professional",
    length: "800 words"
  });

console.log(result.finalOutput); // Polished content
```

## Models Used

| Step | Model | Why |
|------|-------|-----|
| Research | openai:gpt-4o | Broad knowledge base, good at gathering facts |
| Draft | anthropic:claude-3-5-sonnet-20241022 | Excellent writing quality and structure |
| Refine | openai:gpt-4o | Good at editing and polishing |

## Estimated Cost

~$0.05-0.15 per content piece (provider costs only, RelayPlane is BYOK)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| topic | string | Yes | The topic to write about |
| audience | string | Yes | Target audience |
| contentType | string | Yes | Type of content (blog, article, etc.) |
| tone | string | No | Desired tone (default: professional) |
| length | string | No | Target length (default: 500-800 words) |
