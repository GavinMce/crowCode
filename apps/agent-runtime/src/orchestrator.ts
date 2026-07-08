import { randomUUID } from 'node:crypto';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { StorageProvider } from '@crowcode/storage';
import type { SessionEventPayload } from '@crowcode/shared-types';
import { mergeAgents } from './agents/definitions.js';
import { createS3SessionStore } from './s3-session-store.js';

export interface OrchestratorDeps {
  storage: StorageProvider;
  cwd: string;
  projectKey: string;
  /** JSON-encoded managed agents from control-plane; see agents/definitions.ts mergeAgents. */
  managedAgentsJson?: string;
  /** JSON-encoded Record<string, McpServerConfig> from control-plane's integrations. */
  mcpServersJson?: string;
  /** JSON-encoded SdkPluginConfig[] from control-plane's integrations. */
  pluginPathsJson?: string;
  onEvent: (payload: SessionEventPayload) => void | Promise<void>;
}

/** Parses a JSON env var, falling back to `fallback` on missing/malformed input. */
function parseJsonEnv<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export interface OrchestratorTurnOptions {
  /** SDK session id to resume (same or different machine -- resolved via the S3 SessionStore either way). */
  resumeSessionId?: string;
}

function extractParentToolUseId(message: SDKMessage): string | null {
  return 'parent_tool_use_id' in message ? (message.parent_tool_use_id ?? null) : null;
}

function extractAgentType(message: SDKMessage): string | undefined {
  return 'subagent_type' in message && typeof message.subagent_type === 'string'
    ? message.subagent_type
    : undefined;
}

/**
 * Runs one orchestrator turn for a project. Streams every SDK message out via
 * `onEvent` (relayed by the caller over WS to control-plane -> Electron) and
 * relies on the S3-backed SessionStore for durability + cross-machine resume.
 */
export async function runOrchestratorTurn(
  deps: OrchestratorDeps,
  userMessage: string,
  turnOptions: OrchestratorTurnOptions = {},
): Promise<{ sdkSessionId: string | undefined }> {
  const sessionStore = createS3SessionStore(deps.storage);
  let sdkSessionId: string | undefined;

  const stream = query({
    prompt: userMessage,
    options: {
      cwd: deps.cwd,
      agents: mergeAgents(deps.managedAgentsJson),
      // Explicit rather than relying on the SDK's default -- this is what
      // makes repo-native `.claude/agents/*.md` in the checked-out repo
      // discoverable, same convention the CLI itself uses.
      settingSources: ['user', 'project', 'local'],
      mcpServers: parseJsonEnv(deps.mcpServersJson, {}),
      plugins: parseJsonEnv(deps.pluginPathsJson, []),
      sessionStore,
      sessionStoreFlush: 'eager',
      resume: turnOptions.resumeSessionId,
      permissionMode: 'acceptEdits',
    },
  });

  for await (const message of stream as AsyncIterable<SDKMessage>) {
    if (message.type === 'system' && 'session_id' in message) {
      sdkSessionId = (message as { session_id?: string }).session_id ?? sdkSessionId;
    }

    await deps.onEvent({
      type: 'sdk_message',
      parentToolUseId: extractParentToolUseId(message),
      agentType: extractAgentType(message),
      raw: message,
    });
  }

  return { sdkSessionId };
}

export function newProjectKey(projectId: string): string {
  // Namespaced so multiple projects never collide in the shared bucket.
  return `project-${projectId}`;
}

export function newConversationId(): string {
  return randomUUID();
}
