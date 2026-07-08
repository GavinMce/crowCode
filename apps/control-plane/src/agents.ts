import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { StorageProvider } from '@crowcode/storage';
import { CreateManagedAgentRequestSchema, type ManagedAgent, type SdkMessageEvent } from '@crowcode/shared-types';
import type { AgentRow, Db } from './db.js';

export interface AgentsRouteConfig {
  db: Db;
  storage: StorageProvider;
}

/**
 * Reads a managed agent's persistent conversation directly from S3, without
 * needing a live container, since the agent's identity/history outlives
 * any one session's container lifetime.
 *
 * The SDK's own internal resume/session-store mechanism derives its
 * "projectKey" from a *sanitized cwd*, not from anything crowCode passes
 * in -- confirmed by hand (listed the actual keys written to the bucket).
 * Every agent-runtime container uses the same fixed WORK_DIR
 * ("/workspace/repo"), which always sanitizes to "-workspace-repo", so
 * that's hardcoded here rather than guessed at. agentId is used bare (not
 * prefixed) as the session id too, because `--resume` validates its value
 * looks like a UUID or an existing session title -- confirmed by hand, a
 * prefixed string was rejected outright, and agent.id is already a real
 * UUID.
 */
const AGENT_RUNTIME_CWD_KEY = '-workspace-repo';

function agentTranscriptKey(agentId: string): string {
  return `sdk-session-store/${AGENT_RUNTIME_CWD_KEY}/${agentId}.jsonl`;
}

function rowToAgent(row: AgentRow): ManagedAgent {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    model: row.model ?? undefined,
    tools: JSON.parse(row.tools) as string[],
    createdAt: row.createdAt,
  };
}

export function registerAgentRoutes(app: FastifyInstance, config: AgentsRouteConfig): void {
  app.post('/projects/:projectId/agents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    if (!config.db.getProject(projectId)) return reply.status(404).send({ error: 'project not found' });

    const parseResult = CreateManagedAgentRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }
    const body = parseResult.data;

    const row: AgentRow = {
      id: randomUUID(),
      projectId,
      name: body.name,
      description: body.description,
      prompt: body.prompt,
      model: body.model ?? null,
      tools: JSON.stringify(body.tools ?? []),
      createdAt: new Date().toISOString(),
    };
    config.db.insertAgent(row);

    return reply.status(201).send({ agent: rowToAgent(row) });
  });

  app.get('/projects/:projectId/agents', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return config.db.listAgentsForProject(projectId).map(rowToAgent);
  });

  app.delete('/projects/:projectId/agents/:agentId', async (request, reply) => {
    const { projectId, agentId } = request.params as { projectId: string; agentId: string };
    config.db.deleteAgent(agentId, projectId);
    return reply.status(204).send();
  });

  app.get('/projects/:projectId/agents/:agentId/conversation', async (request) => {
    const { agentId } = request.params as { projectId: string; agentId: string };
    const raw = await config.storage.get(agentTranscriptKey(agentId));
    if (!raw) return { events: [] };

    const events: SdkMessageEvent[] = raw
      .toString('utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line: string) => ({
        type: 'sdk_message' as const,
        parentToolUseId: null,
        raw: JSON.parse(line) as unknown,
      }));

    return { events };
  });
}
