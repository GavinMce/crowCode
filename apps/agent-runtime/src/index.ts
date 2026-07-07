import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { S3Provider } from '@crowcode/storage';
import type {
  AgentRuntimeToControlPlaneMessage,
  ControlPlaneToAgentRuntimeMessage,
} from '@crowcode/shared-types';
import { ensureRepoCheckedOut } from './repo.js';
import { newProjectKey, runOrchestratorTurn } from './orchestrator.js';

const {
  CONTROL_PLANE_WS_URL,
  PROJECT_ID,
  REPO_URL,
  GIT_CREDENTIAL,
  DEFAULT_BRANCH = 'main',
  WORKING_BRANCH,
  WORK_DIR = '/workspace/repo',
  S3_BUCKET,
  S3_REGION,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
} = process.env;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

async function main() {
  const projectId = requireEnv('PROJECT_ID', PROJECT_ID);
  const repoUrl = requireEnv('REPO_URL', REPO_URL);
  const workingBranch = requireEnv('WORKING_BRANCH', WORKING_BRANCH);
  const controlPlaneUrl = requireEnv('CONTROL_PLANE_WS_URL', CONTROL_PLANE_WS_URL);
  const bucket = requireEnv('S3_BUCKET', S3_BUCKET);

  const storage = new S3Provider({
    bucket,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: S3_FORCE_PATH_STYLE === 'true',
    credentials:
      S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
        ? { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
        : undefined,
  });

  await ensureRepoCheckedOut({
    repoUrl,
    workDir: WORK_DIR,
    defaultBranch: DEFAULT_BRANCH,
    workingBranch,
    credential: GIT_CREDENTIAL,
  });

  const projectKey = newProjectKey(projectId);
  let sdkSessionId: string | undefined;

  const ws = new WebSocket(controlPlaneUrl);

  function send(message: AgentRuntimeToControlPlaneMessage) {
    ws.send(JSON.stringify(message));
  }

  ws.on('open', () => {
    send({ type: 'register', projectId, sandboxId: process.env.HOSTNAME ?? randomUUID() });
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ControlPlaneToAgentRuntimeMessage;
    if (message.type === 'user_message') {
      void runOrchestratorTurn(
        {
          storage,
          cwd: WORK_DIR,
          projectKey,
          onEvent: (payload) => {
            send({
              type: 'session_event',
              event: {
                projectId,
                sessionId: sdkSessionId ?? 'pending',
                timestamp: new Date().toISOString(),
                payload,
              },
            });
          },
        },
        message.text,
        { resumeSessionId: message.sessionId ?? sdkSessionId },
      ).then((result) => {
        if (result.sdkSessionId) sdkSessionId = result.sdkSessionId;
      });
    }
  });

  ws.on('error', (err) => {
    console.error('control-plane websocket error', err);
  });
}

main().catch((err) => {
  console.error('agent-runtime fatal error', err);
  process.exit(1);
});
