/**
 * Skills API
 */

export interface SkillInfo {
  name: string;
  category: string;
  description: string;
  models: string[];
  contextReduction: string;
  usage: string;
  estimatedCost: string;
}

export interface SkillsResponse {
  skills: SkillInfo[];
}

/**
 * List available pre-built workflow skills.
 *
 * Skills are reusable patterns for common tasks (invoice processing,
 * content pipelines, etc.).
 *
 * @example
 * const { skills } = await listSkills({ category: 'extraction' });
 * console.log(skills.map(s => s.name));
 */
export async function listSkills(options?: { category?: string }): Promise<SkillsResponse> {
  // This function is a placeholder for MCP tool call
  throw new Error(
    'listSkills() must be called via MCP client. ' +
    'Use the relay_skills_list tool through your MCP-enabled AI assistant.'
  );
}
