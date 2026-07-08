import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * v1 specialized roster, invoked by the orchestrator via the SDK's native
 * Task tool. Kept intentionally small: one trivial agent to prove the
 * end-to-end delegation + streaming path works before adding more.
 */
export const subagents: Record<string, AgentDefinition> = {
  'echo-agent': {
    description: 'Trivial subagent used to validate delegation and streaming end-to-end',
    prompt:
      'You are the echo-agent. When invoked, briefly restate the task you were given ' +
      'and confirm you received it. Do not attempt real code changes.',
    tools: [],
    model: 'haiku',
  },
};

interface ManagedAgentSpec {
  name: string;
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
}

/**
 * Merges the hardcoded roster above with project-scoped agents managed
 * through crowCode's UI (control-plane injects them as MANAGED_AGENTS_JSON
 * at session-sandbox creation). Managed agents win on name collision.
 * Malformed/missing input falls back to the hardcoded roster alone.
 */
export function mergeAgents(managedAgentsJson: string | undefined): Record<string, AgentDefinition> {
  const merged: Record<string, AgentDefinition> = { ...subagents };
  if (!managedAgentsJson) return merged;

  let managed: unknown;
  try {
    managed = JSON.parse(managedAgentsJson);
  } catch {
    return merged;
  }
  if (!Array.isArray(managed)) return merged;

  for (const entry of managed as ManagedAgentSpec[]) {
    if (!entry?.name || !entry.description || !entry.prompt) continue;
    merged[entry.name] = {
      description: entry.description,
      prompt: entry.prompt,
      model: entry.model,
      tools: entry.tools,
    };
  }
  return merged;
}
