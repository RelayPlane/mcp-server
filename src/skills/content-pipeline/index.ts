/**
 * Content Pipeline Skill
 *
 * Research, draft, and refine content with multiple AI passes.
 *
 * ## Context Efficiency
 * Without this skill: ~20k tokens (research + draft + refinement all in context)
 * With this skill: ~3k tokens (only final polished content in context)
 * **Context reduction: 85%**
 *
 * ## Models Used
 * - GPT-4o: Research (broad knowledge)
 * - Claude 3.5 Sonnet: Drafting (excellent writing)
 * - GPT-4o: Refinement (polish and edit)
 */

export const contentPipelineConfig = {
  name: 'content-pipeline',
  description: 'Research, draft, and refine content with multiple AI passes.',
  category: 'content',
  contextReduction: '85%',

  steps: [
    {
      name: 'research',
      model: 'openai:gpt-4o',
      prompt: `Research the following topic thoroughly:

Topic: {{input.topic}}
Target audience: {{input.audience}}
Content type: {{input.contentType}}

Provide:
1. Key facts and statistics
2. Main talking points
3. Relevant examples
4. Potential angles or hooks
5. Common misconceptions to address

Be comprehensive - this research will inform the content draft.`,
    },
    {
      name: 'draft',
      model: 'anthropic:claude-3-5-sonnet-20241022',
      depends: ['research'],
      prompt: `Write a first draft based on this research:

Research: {{steps.research.output}}

Requirements:
- Topic: {{input.topic}}
- Audience: {{input.audience}}
- Content type: {{input.contentType}}
- Tone: {{input.tone}}
- Length: {{input.length}}

Create engaging, well-structured content that incorporates the research findings.`,
    },
    {
      name: 'refine',
      model: 'openai:gpt-4o',
      depends: ['draft'],
      prompt: `Polish and refine this draft:

Draft: {{steps.draft.output}}

Improvements to make:
1. Strengthen the opening hook
2. Improve flow and transitions
3. Enhance clarity and readability
4. Fix any grammatical issues
5. Ensure consistent tone throughout
6. Add compelling conclusion

Return the final, polished version.`,
    },
  ],

  estimatedCost: '$0.05-0.15 per piece',
};

/**
 * Get the workflow configuration for content pipeline
 */
export function getContentPipelineWorkflow(input: {
  topic: string;
  audience: string;
  contentType: string;
  tone?: string;
  length?: string;
}) {
  return {
    name: contentPipelineConfig.name,
    steps: contentPipelineConfig.steps,
    input: {
      topic: input.topic,
      audience: input.audience,
      contentType: input.contentType,
      tone: input.tone || 'professional',
      length: input.length || '500-800 words',
    },
  };
}
