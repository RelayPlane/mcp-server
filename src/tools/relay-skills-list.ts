/**
 * relay_skills_list Tool
 *
 * List available pre-built workflow skills.
 * Skills are reusable patterns for common tasks.
 */

import { z } from 'zod';

export const relaySkillsListSchema = z.object({
  category: z
    .enum(['extraction', 'content', 'integration', 'all'])
    .optional()
    .describe('Optional: filter by category'),
});

export type RelaySkillsListInput = z.infer<typeof relaySkillsListSchema>;

export interface SkillInfo {
  name: string;
  category: string;
  description: string;
  models: string[];
  contextReduction: string;
  usage: string;
  estimatedCost: string;
}

// Pre-built skills registry
const SKILLS: SkillInfo[] = [
  {
    name: 'invoice-processor',
    category: 'extraction',
    description: 'Extract, validate, and summarize invoice data from images or PDFs.',
    models: ['openai:gpt-4o', 'anthropic:claude-3-5-sonnet-20241022', 'openai:gpt-4o-mini'],
    contextReduction: '97% (from ~15k to ~500 tokens)',
    usage: `await relay.workflow("invoice-processor")
  .step("extract").with("openai:gpt-4o").prompt("Extract invoice fields...")
  .step("validate").with("anthropic:claude-3-5-sonnet-20241022").depends("extract").prompt("Verify totals...")
  .step("summarize").with("openai:gpt-4o-mini").depends("validate").prompt("Create summary...")
  .run({ fileUrl: "..." })`,
    estimatedCost: '$0.02-0.05 per invoice',
  },
  {
    name: 'content-pipeline',
    category: 'content',
    description: 'Research, draft, and refine content with multiple AI passes.',
    models: ['openai:gpt-4o', 'anthropic:claude-3-5-sonnet-20241022'],
    contextReduction: '85% (from ~20k to ~3k tokens)',
    usage: `await relay.workflow("content-pipeline")
  .step("research").with("openai:gpt-4o").prompt("Research topic: {{input.topic}}...")
  .step("draft").with("anthropic:claude-3-5-sonnet-20241022").depends("research").prompt("Write draft...")
  .step("refine").with("openai:gpt-4o").depends("draft").prompt("Polish and finalize...")
  .run({ topic: "..." })`,
    estimatedCost: '$0.05-0.15 per piece',
  },
  {
    name: 'lead-enrichment',
    category: 'integration',
    description: 'Enrich lead data with company info, social profiles, and qualification scores.',
    models: ['openai:gpt-4o-mini', 'anthropic:claude-3-5-haiku-20241022'],
    contextReduction: '90% (from ~10k to ~1k tokens)',
    usage: `await relay.workflow("lead-enrichment")
  .step("lookup").mcp("clearbit:lookup").params({ email: "{{input.email}}" })
  .step("analyze").with("anthropic:claude-3-5-haiku-20241022").depends("lookup").prompt("Score lead...")
  .step("format").with("openai:gpt-4o-mini").depends("analyze").prompt("Format for CRM...")
  .run({ email: "..." })`,
    estimatedCost: '$0.01-0.03 per lead',
  },
  {
    name: 'document-qa',
    category: 'extraction',
    description: 'Answer questions about documents using RAG pattern with context preservation.',
    models: ['openai:gpt-4o', 'anthropic:claude-3-5-sonnet-20241022'],
    contextReduction: '75% (from ~50k to ~12k tokens)',
    usage: `await relay.workflow("document-qa")
  .step("chunk").with("openai:gpt-4o-mini").prompt("Split document into chunks...")
  .step("embed").mcp("embeddings:create").params({ texts: "{{steps.chunk.output}}" })
  .step("answer").with("openai:gpt-4o").depends("embed").prompt("Answer: {{input.question}}...")
  .run({ document: "...", question: "..." })`,
    estimatedCost: '$0.02-0.10 per query',
  },
  {
    name: 'code-review',
    category: 'content',
    description: 'Multi-stage code review: security, performance, and style analysis.',
    models: ['anthropic:claude-3-5-sonnet-20241022', 'openai:gpt-4o'],
    contextReduction: '80% (from ~25k to ~5k tokens)',
    usage: `await relay.workflow("code-review")
  .step("security").with("anthropic:claude-3-5-sonnet-20241022").prompt("Analyze security...")
  .step("performance").with("openai:gpt-4o").prompt("Analyze performance...")
  .step("style").with("openai:gpt-4o-mini").prompt("Check code style...")
  .step("summary").with("anthropic:claude-3-5-sonnet-20241022").depends("security", "performance", "style").prompt("Summarize findings...")
  .run({ code: "..." })`,
    estimatedCost: '$0.05-0.20 per review',
  },
  {
    name: 'email-classifier',
    category: 'extraction',
    description: 'Classify emails by intent, urgency, and route to appropriate handlers.',
    models: ['openai:gpt-4o-mini', 'anthropic:claude-3-5-haiku-20241022'],
    contextReduction: '95% (from ~8k to ~400 tokens)',
    usage: `await relay.workflow("email-classifier")
  .step("classify").with("openai:gpt-4o-mini").prompt("Classify email intent and urgency...")
  .step("route").with("anthropic:claude-3-5-haiku-20241022").depends("classify").prompt("Determine routing...")
  .run({ email: "..." })`,
    estimatedCost: '$0.001-0.005 per email',
  },
];

export interface RelaySkillsListResponse {
  skills: SkillInfo[];
}

export async function relaySkillsList(
  input: RelaySkillsListInput
): Promise<RelaySkillsListResponse> {
  let skills = [...SKILLS];

  // Filter by category if specified
  if (input.category && input.category !== 'all') {
    skills = skills.filter(s => s.category === input.category);
  }

  // Sort by category, then by name
  skills.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return { skills };
}

export const relaySkillsListDefinition = {
  name: 'relay_skills_list',
  description:
    'List available pre-built workflow skills. Skills are reusable patterns for common tasks (invoice processing, content pipelines, etc.). Returns skill names, descriptions, context reduction metrics, and usage examples.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Optional: filter by category',
        enum: ['extraction', 'content', 'integration', 'all'],
      },
    },
  },
};
