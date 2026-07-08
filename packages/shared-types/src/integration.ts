import { z } from 'zod';

export const IntegrationKindSchema = z.enum(['mcp', 'plugin']);
export type IntegrationKind = z.infer<typeof IntegrationKindSchema>;

/**
 * Public shape -- config is never returned once created (it may carry an MCP
 * server's API key/token), same pattern as a project's git credential.
 */
export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: IntegrationKindSchema,
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Integration = z.infer<typeof IntegrationSchema>;

/**
 * `config` shape depends on `kind`:
 * - mcp: an McpServerConfig-like object, e.g.
 *   `{ type: 'stdio', command: 'npx', args: [...], env: {...} }` or
 *   `{ type: 'http', url: '...', headers: {...} }`
 * - plugin: `{ path: string }`, a local plugin directory inside the
 *   checked-out repo.
 * Not validated further here -- agent-runtime passes it through to the SDK,
 * which does its own validation.
 */
export const CreateIntegrationRequestSchema = z.object({
  kind: IntegrationKindSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});
export type CreateIntegrationRequest = z.infer<typeof CreateIntegrationRequestSchema>;
