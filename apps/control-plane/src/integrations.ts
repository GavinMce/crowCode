import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CreateIntegrationRequestSchema, type Integration } from '@crowcode/shared-types';
import type { Db, IntegrationRow } from './db.js';
import { encryptSecret } from './secrets.js';

export interface IntegrationsRouteConfig {
  db: Db;
}

function rowToIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as Integration['kind'],
    name: row.name,
    createdAt: row.createdAt,
  };
}

export function registerIntegrationRoutes(app: FastifyInstance, config: IntegrationsRouteConfig): void {
  app.post('/projects/:projectId/integrations', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    if (!config.db.getProject(projectId)) return reply.status(404).send({ error: 'project not found' });

    const parseResult = CreateIntegrationRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }
    const body = parseResult.data;

    const row: IntegrationRow = {
      id: randomUUID(),
      projectId,
      kind: body.kind,
      name: body.name,
      encryptedConfig: encryptSecret(JSON.stringify(body.config)),
      createdAt: new Date().toISOString(),
    };
    config.db.insertIntegration(row);

    return reply.status(201).send({ integration: rowToIntegration(row) });
  });

  app.get('/projects/:projectId/integrations', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return config.db.listIntegrationsForProject(projectId).map(rowToIntegration);
  });

  app.delete('/projects/:projectId/integrations/:integrationId', async (request, reply) => {
    const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
    config.db.deleteIntegration(integrationId, projectId);
    return reply.status(204).send();
  });
}
