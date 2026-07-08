import { z } from 'zod';

/**
 * A project-scoped agent managed through crowCode's UI, stored in
 * control-plane's DB and injected into new sessions' sandboxes. Distinct
 * from repo-native agents (`.claude/agents/*.md` checked into the target
 * repo, discovered by the SDK itself via settingSources) -- both coexist.
 */
export const ManagedAgentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
  tools: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});
export type ManagedAgent = z.infer<typeof ManagedAgentSchema>;

export const CreateManagedAgentRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
});
export type CreateManagedAgentRequest = z.infer<typeof CreateManagedAgentRequestSchema>;
