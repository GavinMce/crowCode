import { describe, expect, it } from 'vitest';
import {
  ElectronToControlPlaneMessageSchema,
  AgentRuntimeToControlPlaneMessageSchema,
} from './ws-protocol.js';

describe('ElectronToControlPlaneMessageSchema', () => {
  it('accepts a subscribe message', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      type: 'subscribe',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a user_message without a sessionId', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      type: 'user_message',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      text: 'hello',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a message with no discriminant', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      text: 'hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentRuntimeToControlPlaneMessageSchema', () => {
  it('accepts a register message', () => {
    const result = AgentRuntimeToControlPlaneMessageSchema.safeParse({
      type: 'register',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      sandboxId: 'container-abc123',
    });
    expect(result.success).toBe(true);
  });
});
