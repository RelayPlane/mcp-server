/**
 * Lead Enrichment Skill
 *
 * Enrich lead data with company info, social profiles, and qualification scores.
 *
 * ## Context Efficiency
 * Without this skill: ~10k tokens (lookup + analysis + formatting all in context)
 * With this skill: ~1k tokens (only enriched lead data in context)
 * **Context reduction: 90%**
 *
 * ## Models Used
 * - Claude 3.5 Haiku: Analysis (fast, good reasoning)
 * - GPT-4o-mini: Formatting (fast, cheap)
 */

export const leadEnrichmentConfig = {
  name: 'lead-enrichment',
  description: 'Enrich lead data with company info, social profiles, and qualification scores.',
  category: 'integration',
  contextReduction: '90%',

  steps: [
    {
      name: 'lookup',
      // This would use an MCP tool in real implementation
      model: 'openai:gpt-4o-mini',
      prompt: `Given this lead email, extract what we know:

Email: {{input.email}}
Name: {{input.name}}

Infer and provide:
1. Likely company name and domain
2. Probable role/title
3. Industry
4. Company size estimate

This is for lead qualification purposes.`,
    },
    {
      name: 'analyze',
      model: 'anthropic:claude-3-5-haiku-20241022',
      depends: ['lookup'],
      prompt: `Score this lead based on the enriched data:

Lead data: {{steps.lookup.output}}

Provide:
1. Lead score (1-100)
2. Qualification tier (Hot/Warm/Cold)
3. Key signals (positive and negative)
4. Recommended next action
5. Best contact channel

Be concise but thorough.`,
    },
    {
      name: 'format',
      model: 'openai:gpt-4o-mini',
      depends: ['analyze'],
      prompt: `Format this lead analysis for CRM import:

Analysis: {{steps.analyze.output}}
Original lead: {{input.email}}, {{input.name}}

Create a structured JSON object suitable for CRM import with:
- contact info
- company info
- lead score
- qualification tier
- notes
- recommended actions`,
      schema: {
        type: 'object',
        properties: {
          contact: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              name: { type: 'string' },
              title: { type: 'string' },
            },
          },
          company: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              domain: { type: 'string' },
              industry: { type: 'string' },
              size: { type: 'string' },
            },
          },
          qualification: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              tier: { type: 'string' },
              signals: { type: 'array', items: { type: 'string' } },
            },
          },
          nextAction: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  ],

  estimatedCost: '$0.01-0.03 per lead',
};

/**
 * Get the workflow configuration for lead enrichment
 */
export function getLeadEnrichmentWorkflow(input: { email: string; name?: string }) {
  return {
    name: leadEnrichmentConfig.name,
    steps: leadEnrichmentConfig.steps,
    input: {
      email: input.email,
      name: input.name || '',
    },
  };
}
