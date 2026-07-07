import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { SandboxProvider } from '@crowcode/sandbox';
import { CreateProjectRequestSchema, type Project } from '@crowcode/shared-types';
import type { Db } from './db.js';
import { encryptSecret } from './secrets.js';

export interface ProjectsRouteConfig {
  db: Db;
  sandboxProvider: SandboxProvider;
  agentRuntimeImage: string;
  controlPlaneWsUrlForRuntime: string;
  s3: {
    bucket: string;
    region?: string;
    endpoint?: string;
    forcePathStyle?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
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
      workingBranch: `crowcode/${randomUUID().slice(0, 8)}`,
      image: config.agentRuntimeImage,
      agentRoster: [{ name: 'echo-agent', description: 'Trivial subagent for end-to-end validation' }],
      createdAt: new Date().toISOString(),
    };

    config.db.insertProject({
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      workingBranch: project.workingBranch,
      image: project.image,
      encryptedGitCredential: encryptSecret(body.gitCredential),
      createdAt: project.createdAt,
    });

    const sandbox = await config.sandboxProvider.create({
      projectId: project.id,
      image: project.image,
      env: {
        PROJECT_ID: project.id,
        REPO_URL: project.repoUrl,
        DEFAULT_BRANCH: project.defaultBranch,
        WORKING_BRANCH: project.workingBranch,
        CONTROL_PLANE_WS_URL: config.controlPlaneWsUrlForRuntime,
        GIT_CREDENTIAL: body.gitCredential,
        S3_BUCKET: config.s3.bucket,
        S3_REGION: config.s3.region ?? '',
        S3_ENDPOINT: config.s3.endpoint ?? '',
        S3_FORCE_PATH_STYLE: config.s3.forcePathStyle ?? 'false',
        S3_ACCESS_KEY_ID: config.s3.accessKeyId ?? '',
        S3_SECRET_ACCESS_KEY: config.s3.secretAccessKey ?? '',
      },
    });
    await config.sandboxProvider.start(sandbox.id);

    return reply.status(201).send({ project, sandboxId: sandbox.id });
  });

  app.get('/projects', async () => {
    return config.db.listProjects();
  });
}
