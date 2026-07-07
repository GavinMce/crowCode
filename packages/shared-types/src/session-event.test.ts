import { describe, expect, it } from 'vitest';
import { SessionEventSchema } from './session-event.js';

describe('SessionEventSchema', () => {
  const base = {
    projectId: '123e4567-e89b-12d3-a456-426614174000',
    sessionId: 'sdk-session-1',
    timestamp: new Date().toISOString(),
  };

  it('accepts a lifecycle event payload', () => {
    const result = SessionEventSchema.safeParse({
      ...base,
      payload: { type: 'git_commit_created', sha: 'abc123', branch: 'crowcode/x', message: 'fix' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an sdk_message payload with a null parentToolUseId', () => {
    const result = SessionEventSchema.safeParse({
      ...base,
      payload: { type: 'sdk_message', parentToolUseId: null, raw: { type: 'assistant' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload with an unknown discriminant', () => {
    const result = SessionEventSchema.safeParse({
      ...base,
      payload: { type: 'not_a_real_event' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID projectId', () => {
    const result = SessionEventSchema.safeParse({
      ...base,
      projectId: 'not-a-uuid',
      payload: { type: 'memory_flushed', key: 'memory/MEMORY.md' },
    });
    expect(result.success).toBe(false);
  });
});
