import { describe, expect, it } from 'vitest';
import { mergeAgents, subagents } from './definitions.js';

describe('mergeAgents', () => {
  it('returns the hardcoded roster when no managed agents are provided', () => {
    expect(mergeAgents(undefined)).toEqual(subagents);
  });

  it('falls back to the hardcoded roster on malformed JSON', () => {
    expect(mergeAgents('not json')).toEqual(subagents);
  });

  it('falls back to the hardcoded roster when the JSON is not an array', () => {
    expect(mergeAgents('{"name":"x"}')).toEqual(subagents);
  });

  it('merges in valid managed agents', () => {
    const managed = JSON.stringify([
      { name: 'reviewer', description: 'Reviews diffs', prompt: 'You are a reviewer.', model: 'sonnet', tools: ['Read'] },
    ]);
    const result = mergeAgents(managed);
    expect(result['echo-agent']).toEqual(subagents['echo-agent']);
    expect(result.reviewer).toEqual({
      description: 'Reviews diffs',
      prompt: 'You are a reviewer.',
      model: 'sonnet',
      tools: ['Read'],
    });
  });

  it('skips malformed entries but keeps valid ones', () => {
    const managed = JSON.stringify([
      { name: 'incomplete' },
      { name: 'valid', description: 'd', prompt: 'p' },
    ]);
    const result = mergeAgents(managed);
    expect(result.incomplete).toBeUndefined();
    expect(result.valid).toBeDefined();
  });

  it('lets a managed agent override the hardcoded roster on name collision', () => {
    const managed = JSON.stringify([{ name: 'echo-agent', description: 'overridden', prompt: 'p' }]);
    const result = mergeAgents(managed);
    expect(result['echo-agent'].description).toBe('overridden');
  });
});
