import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { SandboxProvider } from '@crowcode/sandbox';
import { CreateSessionRequestSchema, type Session } from '@crowcode/shared-types';
import type { Db, SessionRow } from './db.js';
import { decryptSecret } from './secrets.js';

export interface SessionsRouteConfig {
  db: Db;
  sandboxProvider: SandboxProvider;
  controlPlaneWsUrlForRuntime: string;
  anthropicApiKey: string;
  s3: {
    bucket: string;
    region?: string;
    endpoint?: string;
    forcePathStyle?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    branch: row.branch,
    sandboxId: row.sandboxId,
    status: row.status as Session['status'],
    createdAt: row.createdAt,
  };
}

export function registerSessionRoutes(app: FastifyInstance, config: SessionsRouteConfig): void {
  app.post('/projects/:projectId/sessions', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = config.db.getProject(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });

    const parseResult = CreateSessionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }
    const body = parseResult.data;

    const sessionRow: SessionRow = {
      id: randomUUID(),
      projectId: project.id,
      title: body.title,
      branch: `crowcode/${randomUUID().slice(0, 8)}`,
      sandboxId: null,
      status: 'starting',
      createdAt: new Date().toISOString(),
    };
    config.db.insertSession(sessionRow);

    const managedAgents = config.db.listAgentsForProject(project.id).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      prompt: row.prompt,
      model: row.model ?? undefined,
      tools: JSON.parse(row.tools) as string[],
    }));

    const integrations = config.db.listIntegrationsForProject(project.id);
    const mcpServers: Record<string, unknown> = {};
    const pluginPaths: Array<{ type: 'local'; path: string }> = [];
    for (const integration of integrations) {
      const decoded = JSON.parse(decryptSecret(integration.encryptedConfig)) as Record<string, unknown>;
      if (integration.kind === 'mcp') {
        mcpServers[integration.name] = decoded;
      } else if (integration.kind === 'plugin' && typeof decoded.path === 'string') {
        pluginPaths.push({ type: 'local', path: decoded.path });
      }
    }

    const sandbox = await config.sandboxProvider.create({
      projectId: project.id,
      image: project.image,
      env: {
        SESSION_ID: sessionRow.id,
        PROJECT_ID: project.id,
        REPO_URL: project.repoUrl,
        DEFAULT_BRANCH: project.defaultBranch,
        WORKING_BRANCH: sessionRow.branch,
        CONTROL_PLANE_WS_URL: config.controlPlaneWsUrlForRuntime,
        GIT_CREDENTIAL: decryptSecret(project.encryptedGitCredential),
        ANTHROPIC_API_KEY: config.anthropicApiKey,
        MANAGED_AGENTS_JSON: JSON.stringify(managedAgents),
        MCP_SERVERS_JSON: JSON.stringify(mcpServers),
        PLUGIN_PATHS_JSON: JSON.stringify(pluginPaths),
        S3_BUCKET: config.s3.bucket,
        S3_REGION: config.s3.region ?? '',
        S3_ENDPOINT: config.s3.endpoint ?? '',
        S3_FORCE_PATH_STYLE: config.s3.forcePathStyle ?? 'false',
        S3_ACCESS_KEY_ID: config.s3.accessKeyId ?? '',
        S3_SECRET_ACCESS_KEY: config.s3.secretAccessKey ?? '',
      },
    });
    await config.sandboxProvider.start(sandbox.id);
    config.db.updateSessionSandbox(sessionRow.id, sandbox.id, 'running');

    return reply.status(201).send({
      session: rowToSession({ ...sessionRow, sandboxId: sandbox.id, status: 'running' }),
    });
  });

  app.get('/projects/:projectId/sessions', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return config.db.listSessionsForProject(projectId).map(rowToSession);
  });
}
