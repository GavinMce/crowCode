import type { SdkMessageEvent } from '@crowcode/shared-types';

export interface TextContentBlock {
  kind: 'text';
  id: string;
  text: string;
}

export interface ThinkingContentBlock {
  kind: 'thinking';
  id: string;
  text: string;
}

export interface ToolCallContentBlock {
  kind: 'tool_call';
  id: string;
  toolUseId: string;
  name: string;
  input: unknown;
  result?: { text: string; isError: boolean };
  childTurns: AssistantTurn[];
}

export type ContentBlock = TextContentBlock | ThinkingContentBlock | ToolCallContentBlock;

export interface AssistantTurn {
  kind: 'assistant';
  id: string;
  agentType?: string;
  blocks: ContentBlock[];
}

export interface MetaTurn {
  kind: 'meta';
  id: string;
  subtype: 'init' | 'result' | 'error' | 'compact';
  text: string;
}

export type Turn = AssistantTurn | MetaTurn;

/**
 * Structural shapes for the raw Claude Agent SDK messages we care about.
 * Kept minimal/local rather than depending on @anthropic-ai/claude-agent-sdk
 * from the renderer -- session-event.ts already treats `raw` as unknown for
 * the same reason.
 */
interface RawContentBlock {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface RawAssistantMessage {
  type: 'assistant';
  uuid?: string;
  message?: { content?: RawContentBlock[] };
}

interface RawUserMessage {
  type: 'user';
  message?: { content?: RawContentBlock[] };
}

interface RawSystemInitMessage {
  type: 'system';
  subtype: string;
  uuid?: string;
  model?: string;
  cwd?: string;
}

interface RawCompactBoundaryMessage {
  type: 'system';
  subtype: 'compact_boundary';
  uuid?: string;
  compact_metadata?: {
    trigger?: 'manual' | 'auto';
    pre_tokens?: number;
    post_tokens?: number;
  };
}

interface RawResultMessage {
  type: 'result';
  uuid?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
}

type RawSdkMessage =
  | RawAssistantMessage
  | RawUserMessage
  | RawSystemInitMessage
  | RawCompactBoundaryMessage
  | RawResultMessage
  | { type: string };

function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        block && typeof block === 'object' && typeof (block as RawContentBlock).text === 'string'
          ? (block as RawContentBlock).text
          : '',
      )
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

let counter = 0;
function fallbackId(): string {
  counter += 1;
  return `block-${counter}`;
}

/**
 * Turns the accumulated stream of session events for one chat session into
 * an ordered list of renderable turns. Tool calls (`tool_use`) are matched
 * to their result (`tool_result`, delivered in a later 'user' message) by
 * id, and assistant messages produced by a subagent (`parentToolUseId` set)
 * are nested under the tool_call block that spawned them instead of
 * appearing at the top level -- mirroring how the CLI nests subagent output
 * under its Task call.
 */
export function parseSdkEvents(events: SdkMessageEvent[]): Turn[] {
  const topLevel: Turn[] = [];
  const toolCallsById = new Map<string, ToolCallContentBlock>();

  for (const event of events) {
    const raw = event.raw as RawSdkMessage | null | undefined;
    if (!raw || typeof raw !== 'object' || !('type' in raw)) continue;

    if (raw.type === 'assistant') {
      const content = (raw as RawAssistantMessage).message?.content;
      if (!Array.isArray(content)) continue;

      const blocks: ContentBlock[] = [];
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          blocks.push({ kind: 'text', id: fallbackId(), text: block.text });
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          blocks.push({ kind: 'thinking', id: fallbackId(), text: block.thinking });
        } else if (block.type === 'tool_use' && typeof block.id === 'string') {
          const toolCall: ToolCallContentBlock = {
            kind: 'tool_call',
            id: block.id,
            toolUseId: block.id,
            name: typeof block.name === 'string' ? block.name : 'tool',
            input: block.input,
            childTurns: [],
          };
          toolCallsById.set(block.id, toolCall);
          blocks.push(toolCall);
        }
      }
      if (blocks.length === 0) continue;

      const turn: AssistantTurn = {
        kind: 'assistant',
        id: (raw as RawAssistantMessage).uuid ?? fallbackId(),
        agentType: event.agentType,
        blocks,
      };

      const parentCall = event.parentToolUseId ? toolCallsById.get(event.parentToolUseId) : undefined;
      if (parentCall) {
        parentCall.childTurns.push(turn);
      } else {
        topLevel.push(turn);
      }
    } else if (raw.type === 'user') {
      const content = (raw as RawUserMessage).message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
          const call = toolCallsById.get(block.tool_use_id);
          if (call) {
            call.result = {
              text: extractToolResultText(block.content),
              isError: Boolean(block.is_error),
            };
          }
        }
      }
    } else if (raw.type === 'system' && (raw as RawSystemInitMessage).subtype === 'init') {
      const sys = raw as RawSystemInitMessage;
      topLevel.push({
        kind: 'meta',
        id: sys.uuid ?? fallbackId(),
        subtype: 'init',
        text: `Session started · ${sys.model ?? 'unknown model'}${sys.cwd ? ` · ${sys.cwd}` : ''}`,
      });
    } else if (raw.type === 'system' && (raw as RawCompactBoundaryMessage).subtype === 'compact_boundary') {
      const compact = raw as RawCompactBoundaryMessage;
      const pre = compact.compact_metadata?.pre_tokens;
      const post = compact.compact_metadata?.post_tokens;
      const tokenSummary =
        typeof pre === 'number' && typeof post === 'number'
          ? ` · ${pre.toLocaleString()} → ${post.toLocaleString()} tokens`
          : '';
      topLevel.push({
        kind: 'meta',
        id: compact.uuid ?? fallbackId(),
        subtype: 'compact',
        text: `Context compacted${tokenSummary}`,
      });
    } else if (raw.type === 'result') {
      const result = raw as RawResultMessage;
      const seconds = typeof result.duration_ms === 'number' ? (result.duration_ms / 1000).toFixed(1) : '?';
      const cost = typeof result.total_cost_usd === 'number' ? ` · $${result.total_cost_usd.toFixed(4)}` : '';
      topLevel.push({
        kind: 'meta',
        id: result.uuid ?? fallbackId(),
        subtype: result.is_error ? 'error' : 'result',
        text: `Turn complete · ${seconds}s${cost}`,
      });
    }
  }

  return topLevel;
}
