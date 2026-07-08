import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CreateManagedAgentRequestSchema, type ManagedAgent } from '@crowcode/shared-types';
import type { AgentRow, Db } from './db.js';

export interface AgentsRouteConfig {
  db: Db;
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
}
