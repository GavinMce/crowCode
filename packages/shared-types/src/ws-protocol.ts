import { z } from 'zod';
import { SessionEventSchema } from './session-event.js';

export const AgentStatusSchema = z.enum(['running', 'idle']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// --- Electron <-> control-plane ---

export const ElectronToControlPlaneMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), sessionId: z.string().uuid() }),
  z.object({ type: z.literal('subscribe_project'), projectId: z.string().uuid() }),
  z.object({
    type: z.literal('user_message'),
    sessionId: z.string().uuid(),
    text: z.string(),
  }),
]);
export type ElectronToControlPlaneMessage = z.infer<typeof ElectronToControlPlaneMessageSchema>;

export const ControlPlaneToElectronMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session_event'), event: SessionEventSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({
    type: z.literal('agent_status'),
    projectId: z.string().uuid(),
    agentId: z.string().uuid(),
    status: AgentStatusSchema,
  }),
]);
export type ControlPlaneToElectronMessage = z.infer<typeof ControlPlaneToElectronMessageSchema>;

// --- agent-runtime <-> control-plane ---

export const AgentRuntimeToControlPlaneMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('register'), sessionId: z.string().uuid(), sandboxId: z.string() }),
  z.object({ type: z.literal('session_event'), event: SessionEventSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({
    type: z.literal('agent_status'),
    projectId: z.string().uuid(),
    agentId: z.string().uuid(),
    status: AgentStatusSchema,
  }),
]);
export type AgentRuntimeToControlPlaneMessage = z.infer<typeof AgentRuntimeToControlPlaneMessageSchema>;

export const ControlPlaneToAgentRuntimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user_message'), resumeSdkSessionId: z.string().optional(), text: z.string() }),
]);
export type ControlPlaneToAgentRuntimeMessage = z.infer<typeof ControlPlaneToAgentRuntimeMessageSchema>;
