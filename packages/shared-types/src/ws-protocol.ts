import { z } from 'zod';
import { SessionEventSchema } from './session-event.js';

// --- Electron <-> control-plane ---

export const ElectronToControlPlaneMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), projectId: z.string().uuid() }),
  z.object({
    type: z.literal('user_message'),
    projectId: z.string().uuid(),
    sessionId: z.string().optional(),
    text: z.string(),
  }),
]);
export type ElectronToControlPlaneMessage = z.infer<typeof ElectronToControlPlaneMessageSchema>;

export const ControlPlaneToElectronMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session_event'), event: SessionEventSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ControlPlaneToElectronMessage = z.infer<typeof ControlPlaneToElectronMessageSchema>;

// --- agent-runtime <-> control-plane ---

export const AgentRuntimeToControlPlaneMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('register'), projectId: z.string().uuid(), sandboxId: z.string() }),
  z.object({ type: z.literal('session_event'), event: SessionEventSchema }),
]);
export type AgentRuntimeToControlPlaneMessage = z.infer<typeof AgentRuntimeToControlPlaneMessageSchema>;

export const ControlPlaneToAgentRuntimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user_message'), sessionId: z.string().optional(), text: z.string() }),
]);
export type ControlPlaneToAgentRuntimeMessage = z.infer<typeof ControlPlaneToAgentRuntimeMessageSchema>;
