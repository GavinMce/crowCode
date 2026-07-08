import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CreateProjectRequestSchema, type Project } from '@crowcode/shared-types';
import type { Db } from './db.js';
import { encryptSecret } from './secrets.js';

export interface ProjectsRouteConfig {
  db: Db;
  agentRuntimeImage: string;
}

export function registerProjectRoutes(app: FastifyInstance, config: ProjectsRouteConfig): void {
  app.post('/projects', async (request, reply) => {
    const parseResult = CreateProjectRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }
    const body = parseResult.data;

    const project: Project = {
      id: randomUUID(),
      name: body.name,
      repoUrl: body.repoUrl,
      defaultBranch: body.defaultBranch ?? 'main',
      image: config.agentRuntimeImage,
      agentRoster: [{ name: 'echo-agent', description: 'Trivial subagent for end-to-end validation' }],
      createdAt: new Date().toISOString(),
    };

    config.db.insertProject({
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      image: project.image,
      encryptedGitCredential: encryptSecret(body.gitCredential),
      createdAt: project.createdAt,
    });

    return reply.status(201).send({ project });
  });

  app.get('/projects', async () => {
    return config.db.listProjects();
  });
}
