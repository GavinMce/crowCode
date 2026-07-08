import { describe, expect, it } from 'vitest';
import { CreateManagedAgentRequestSchema, ManagedAgentSchema } from './agent.js';

describe('ManagedAgentSchema', () => {
  it('accepts a fully-formed managed agent', () => {
    const result = ManagedAgentSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'reviewer',
      description: 'Reviews diffs for style issues',
      prompt: 'You are a strict code reviewer.',
      model: 'sonnet',
      tools: ['Read', 'Grep'],
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('defaults tools to an empty array when omitted', () => {
    const result = ManagedAgentSchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'reviewer',
      description: 'Reviews diffs',
      prompt: 'You are a reviewer.',
      createdAt: new Date().toISOString(),
    });
    expect(result.tools).toEqual([]);
  });
});

describe('CreateManagedAgentRequestSchema', () => {
  it('rejects a request missing the prompt', () => {
    const result = CreateManagedAgentRequestSchema.safeParse({
      name: 'reviewer',
      description: 'Reviews diffs',
    });
    expect(result.success).toBe(false);
  });
});
