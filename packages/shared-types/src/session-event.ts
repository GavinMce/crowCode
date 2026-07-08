import { z } from 'zod';

/**
 * Lifecycle events emitted by agent-runtime that aren't raw SDK messages.
 */
export const LifecycleEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sandbox_started'), sandboxId: z.string() }),
  z.object({ type: z.literal('sandbox_stopped'), sandboxId: z.string() }),
  z.object({
    type: z.literal('git_commit_created'),
    sha: z.string(),
    branch: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal('memory_flushed'), key: z.string() }),
  z.object({
    type: z.literal('diff_snapshot'),
    /** Unified diff of `defaultBranch...workingBranch`, recomputed after every commit. */
    diff: z.string(),
  }),
]);
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

/**
 * Wraps a raw Claude Agent SDK message. Kept as a passthrough blob (not a
 * full schema mirroring the SDK's SDKMessage union) so shared-types doesn't
 * need to depend on @anthropic-ai/claude-agent-sdk. `parentToolUseId` /
 * `agentType` are lifted out for consumers (e.g. the Electron activity feed)
 * that want to nest subagent output without parsing the SDK's raw shape.
 */
export const SdkMessageEventSchema = z.object({
  type: z.literal('sdk_message'),
  parentToolUseId: z.string().nullable(),
  agentType: z.string().optional(),
  raw: z.unknown(),
});
export type SdkMessageEvent = z.infer<typeof SdkMessageEventSchema>;

export const SessionEventPayloadSchema = z.union([LifecycleEventSchema, SdkMessageEventSchema]);
export type SessionEventPayload = z.infer<typeof SessionEventPayloadSchema>;

/**
 * Envelope relayed verbatim agent-runtime -> control-plane -> Electron.
 * `sdkSessionId` is the Claude Agent SDK's own resumable session id -- not
 * to be confused with crowCode's session (chat thread/branch/sandbox),
 * which the WS connection is already scoped to via `subscribe`.
 */
export const SessionEventSchema = z.object({
  projectId: z.string().uuid(),
  sdkSessionId: z.string(),
  timestamp: z.string().datetime(),
  payload: SessionEventPayloadSchema,
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;
