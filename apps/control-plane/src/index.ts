import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { DockerSandboxProvider } from '@crowcode/sandbox';
import {
  AgentRuntimeToControlPlaneMessageSchema,
  ElectronToControlPlaneMessageSchema,
} from '@crowcode/shared-types';
import { Db } from './db.js';
import { registerProjectRoutes } from './projects.js';
import { WsRelay } from './ws-relay.js';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? './control-plane.sqlite';
const AGENT_RUNTIME_IMAGE = process.env.AGENT_RUNTIME_IMAGE ?? 'crowcode/agent-runtime-base:1';
const SELF_WS_URL_FOR_RUNTIME = process.env.SELF_WS_URL_FOR_RUNTIME ?? `ws://host.docker.internal:${PORT}/ws/agent-runtime`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

async function main() {
  const app = Fastify({ logger: true });
  await app.register(fastifyCors, {
    origin: process.env.ELECTRON_RENDERER_URL_ORIGIN ?? 'http://localhost:5173',
  });
  await app.register(fastifyWebsocket);

  const db = new Db(DB_PATH);
  const sandboxProvider = new DockerSandboxProvider({
    socketPath: process.env.DOCKER_SOCKET_PATH,
    host: process.env.DOCKER_HOST,
    port: process.env.DOCKER_PORT ? Number(process.env.DOCKER_PORT) : undefined,
  });
  const relay = new WsRelay();

  registerProjectRoutes(app, {
    db,
    sandboxProvider,
    agentRuntimeImage: AGENT_RUNTIME_IMAGE,
    controlPlaneWsUrlForRuntime: SELF_WS_URL_FOR_RUNTIME,
    anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
    s3: {
      bucket: process.env.S3_BUCKET ?? 'crowcode-dev',
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  app.register(async (instance) => {
    instance.get('/ws/electron', { websocket: true }, (socket) => {
      let subscribedProjectId: string | null = null;

      socket.on('message', (data: Buffer) => {
        const parsed = ElectronToControlPlaneMessageSchema.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) return;
        const message = parsed.data;
        if (message.type === 'subscribe') {
          subscribedProjectId = message.projectId;
          relay.subscribeElectron(message.projectId, socket);
        } else {
          relay.handleElectronMessage(message.projectId, message);
        }
      });

      void subscribedProjectId;
    });

    instance.get('/ws/agent-runtime', { websocket: true }, (socket) => {
      let registeredProjectId: string | null = null;

      socket.on('message', (data: Buffer) => {
        const parsed = AgentRuntimeToControlPlaneMessageSchema.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) return;
        const message = parsed.data;
        if (message.type === 'register') {
          registeredProjectId = message.projectId;
          relay.registerAgentRuntime(message.projectId, socket);
        } else if (registeredProjectId) {
          relay.handleAgentRuntimeMessage(registeredProjectId, message);
        }
      });
    });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('control-plane fatal error', err);
  process.exit(1);
});
