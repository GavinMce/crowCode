import { createSdkMcpServer, query, tool, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { StorageProvider } from '@crowcode/storage';
import type { AgentStatus, SessionEventPayload } from '@crowcode/shared-types';
import { createS3SessionStore } from './s3-session-store.js';

export interface ManagedAgentWithId {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
}

export interface AgentToolsDeps {
  storage: StorageProvider;
  cwd: string;
  onAgentStatus: (agentId: string, status: AgentStatus) => void;
  onAgentEvent: (agentName: string, payload: SessionEventPayload) => void | Promise<void>;
}

function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function extractFinalText(message: SDKMessage): string | null {
  if (message.type !== 'assistant') return null;
  const content = (message as { message?: { content?: Array<{ type?: string; text?: string }> } }).message
    ?.content;
  if (!Array.isArray(content)) return null;
  const texts = content.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text as string);
  return texts.length > 0 ? texts.join('\n') : null;
}

/** True if this result message is the CLI rejecting `resume` for a session id that doesn't exist yet. */
function isMissingConversationError(message: SDKMessage): boolean {
  if (message.type !== 'result' || !('errors' in message)) return false;
  const errors = (message as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.some((e) => typeof e === 'string' && /no conversation found/i.test(e));
}

interface AgentQueryResult {
  messages: SDKMessage[];
  finalText: string;
  missingConversation: boolean;
}

/**
 * `resume: agent.id` continues an agent's established conversation.
 * `sessionId: agent.id` is used instead the first time -- there's no way to
 * know in advance whether this is an agent's first-ever call (the SDK's
 * projectKey is derived internally from cwd via an undocumented sanitizer,
 * so we can't reliably pre-check the store ourselves), so `resume` is
 * always tried first and this distinguishes "doesn't exist yet" from a
 * genuine failure, confirmed by hand against the CLI's actual error text.
 */
async function runAgentQuery(
  agent: ManagedAgentWithId,
  message: string,
  deps: AgentToolsDeps,
  mode: 'resume' | 'create',
): Promise<AgentQueryResult> {
  const sessionStore = createS3SessionStore(deps.storage);
  const stream = query({
    prompt: message,
    options: {
      cwd: deps.cwd,
      model: agent.model,
      ...(agent.tools && agent.tools.length > 0 ? { tools: agent.tools } : {}),
      systemPrompt: agent.prompt,
      sessionStore,
      sessionStoreFlush: 'eager',
      ...(mode === 'resume' ? { resume: agent.id } : { sessionId: agent.id }),
      // Fully unattended: no human is present to answer a permission prompt.
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    },
  });

  const messages: SDKMessage[] = [];
  let finalText = '';
  let missingConversation = false;
  try {
    for await (const message of stream as AsyncIterable<SDKMessage>) {
      messages.push(message);
      if (mode === 'resume' && isMissingConversationError(message)) missingConversation = true;
      const text = extractFinalText(message);
      if (text) finalText = text;
    }
  } catch (err) {
    // A rejected `resume` for a session id with no prior history surfaces
    // as a thrown error from the async iterator, not a streamed `result`
    // message -- confirmed by hand, isMissingConversationError() above
    // never fired because the loop above threw before yielding one.
    const text = err instanceof Error ? err.message : String(err);
    if (mode === 'resume' && /no conversation found/i.test(text)) {
      missingConversation = true;
    } else {
      throw err;
    }
  }
  return { messages, finalText, missingConversation };
}

/**
 * Builds an in-process MCP server (see createSdkMcpServer/tool in the SDK)
 * exposing one tool per managed agent. Unlike the native Task tool (ephemeral,
 * nested inside the calling turn, no persistent identity), each call here
 * resumes that agent's own standing conversation -- reusing the exact same
 * S3-backed session store already built for the orchestrator itself.
 */
export function buildAgentMcpServer(agents: ManagedAgentWithId[], deps: AgentToolsDeps) {
  if (agents.length === 0) return null;

  const tools = agents.map((agent) =>
    tool(
      `call_${sanitizeToolName(agent.name)}`,
      `Delegate to the persistent "${agent.name}" agent: ${agent.description}`,
      { message: z.string().describe('The task or question to send to this agent') },
      async ({ message }) => {
        deps.onAgentStatus(agent.id, 'running');
        try {
          let result = await runAgentQuery(agent, message, deps, 'resume');
          if (result.missingConversation) {
            result = await runAgentQuery(agent, message, deps, 'create');
          }

          for (const raw of result.messages) {
            await deps.onAgentEvent(agent.name, {
              type: 'sdk_message',
              parentToolUseId: null,
              agentType: agent.name,
              raw,
            });
          }

          return {
            content: [{ type: 'text' as const, text: result.finalText || '(agent produced no text response)' }],
          };
        } finally {
          deps.onAgentStatus(agent.id, 'idle');
        }
      },
    ),
  );

  return createSdkMcpServer({ name: 'crowcode-agents', version: '1.0.0', tools });
}
