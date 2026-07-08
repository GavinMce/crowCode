import { z } from 'zod';

export const SessionStatusSchema = z.enum(['starting', 'running', 'stopped', 'error']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  branch: z.string(),
  sandboxId: z.string().nullable(),
  status: SessionStatusSchema,
  createdAt: z.string().datetime(),
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionRequestSchema = z.object({
  title: z.string().min(1),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
