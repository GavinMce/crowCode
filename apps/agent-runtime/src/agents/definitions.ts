import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * v1 specialized roster, invoked by the orchestrator via the SDK's native
 * Task tool. Kept intentionally small: one trivial agent to prove the
 * end-to-end delegation + streaming path works before adding more.
 *
 * Project-scoped agents managed through crowCode's UI do NOT go through
 * this native Task-tool path -- they're persistent (their own resumable
 * conversation, project-scoped, outliving any one session), exposed to the
 * orchestrator as MCP tools instead. See agent-tools.ts.
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
