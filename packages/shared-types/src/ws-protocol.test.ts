import { describe, expect, it } from 'vitest';
import {
  ElectronToControlPlaneMessageSchema,
  AgentRuntimeToControlPlaneMessageSchema,
  ControlPlaneToElectronMessageSchema,
} from './ws-protocol.js';

describe('ElectronToControlPlaneMessageSchema', () => {
  it('accepts a subscribe message', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      type: 'subscribe',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a user_message', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      type: 'user_message',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      text: 'hello',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a subscribe_project message', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      type: 'subscribe_project',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a message with no discriminant', () => {
    const result = ElectronToControlPlaneMessageSchema.safeParse({
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      text: 'hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentRuntimeToControlPlaneMessageSchema', () => {
  it('accepts a register message', () => {
    const result = AgentRuntimeToControlPlaneMessageSchema.safeParse({
      type: 'register',
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      sandboxId: 'container-abc123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an agent_status message', () => {
    const result = AgentRuntimeToControlPlaneMessageSchema.safeParse({
      type: 'agent_status',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: '00000000-0000-0000-0000-000000000000',
      status: 'running',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an agent_status message with an invalid status', () => {
    const result = AgentRuntimeToControlPlaneMessageSchema.safeParse({
      type: 'agent_status',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: '00000000-0000-0000-0000-000000000000',
      status: 'busy',
    });
    expect(result.success).toBe(false);
  });
});

describe('ControlPlaneToElectronMessageSchema', () => {
  it('accepts an agent_status message', () => {
    const result = ControlPlaneToElectronMessageSchema.safeParse({
      type: 'agent_status',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      agentId: '00000000-0000-0000-0000-000000000000',
      status: 'idle',
    });
    expect(result.success).toBe(true);
  });
});
