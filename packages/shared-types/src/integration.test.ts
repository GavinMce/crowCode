import { describe, expect, it } from 'vitest';
import { CreateIntegrationRequestSchema, IntegrationSchema } from './integration.js';

describe('IntegrationSchema', () => {
  it('accepts a fully-formed integration with no config field', () => {
    const result = IntegrationSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      kind: 'mcp',
      name: 'linear',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    const result = IntegrationSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      kind: 'webhook',
      name: 'linear',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateIntegrationRequestSchema', () => {
  it('accepts an mcp stdio config', () => {
    const result = CreateIntegrationRequestSchema.safeParse({
      kind: 'mcp',
      name: 'linear',
      config: { type: 'stdio', command: 'npx', args: ['-y', 'linear-mcp'] },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a plugin config', () => {
    const result = CreateIntegrationRequestSchema.safeParse({
      kind: 'plugin',
      name: 'local-tools',
      config: { path: '.claude/plugins/local-tools' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = CreateIntegrationRequestSchema.safeParse({
      kind: 'mcp',
      config: { type: 'stdio', command: 'npx' },
    });
    expect(result.success).toBe(false);
  });
});
