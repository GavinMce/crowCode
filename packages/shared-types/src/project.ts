import { z } from 'zod';

export const AgentRosterEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
});
export type AgentRosterEntry = z.infer<typeof AgentRosterEntrySchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  repoUrl: z.string().url(),
  defaultBranch: z.string().default('main'),
  workingBranch: z.string(),
  image: z.string().default('crowcode/agent-runtime-base:1'),
  agentRoster: z.array(AgentRosterEntrySchema).default([]),
  createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  repoUrl: z.string().url(),
  defaultBranch: z.string().optional(),
  gitCredential: z.string().min(1).describe('repo-scoped PAT; never persisted verbatim to object storage'),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
