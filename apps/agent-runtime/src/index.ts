import WebSocket from 'ws';
import { S3Provider } from '@crowcode/storage';
import type {
  AgentRuntimeToControlPlaneMessage,
  ControlPlaneToAgentRuntimeMessage,
} from '@crowcode/shared-types';
import { ensureRepoCheckedOut, commitAndPush, computeDiff } from './repo.js';
import { newProjectKey, runOrchestratorTurn } from './orchestrator.js';

const {
  CONTROL_PLANE_WS_URL,
  SESSION_ID,
  PROJECT_ID,
  REPO_URL,
  GIT_CREDENTIAL,
  DEFAULT_BRANCH = 'main',
  WORKING_BRANCH,
  WORK_DIR = '/workspace/repo',
  MANAGED_AGENTS_JSON,
  MCP_SERVERS_JSON,
  PLUGIN_PATHS_JSON,
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
  const sessionId = requireEnv('SESSION_ID', SESSION_ID);
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
    send({ type: 'register', sessionId, sandboxId: process.env.HOSTNAME ?? sessionId });
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ControlPlaneToAgentRuntimeMessage;
    if (message.type === 'user_message') {
      void runOrchestratorTurn(
        {
          storage,
          cwd: WORK_DIR,
          projectKey,
          managedAgentsJson: MANAGED_AGENTS_JSON,
          mcpServersJson: MCP_SERVERS_JSON,
          pluginPathsJson: PLUGIN_PATHS_JSON,
          onEvent: (payload) => {
            send({
              type: 'session_event',
              event: {
                projectId,
                sdkSessionId: sdkSessionId ?? 'pending',
                timestamp: new Date().toISOString(),
                payload,
              },
            });
          },
        },
        message.text,
        { resumeSessionId: message.resumeSdkSessionId ?? sdkSessionId },
      ).then(
        async (result) => {
          if (result.sdkSessionId) sdkSessionId = result.sdkSessionId;

          await commitAndPush(WORK_DIR, `crowCode: ${message.text.slice(0, 72)}`, workingBranch, GIT_CREDENTIAL).catch(
            (err: unknown) => {
              send({ type: 'error', message: `commit/push failed: ${err instanceof Error ? err.message : String(err)}` });
            },
          );

          const diff = await computeDiff(WORK_DIR, DEFAULT_BRANCH, workingBranch).catch(() => null);
          if (diff !== null) {
            send({
              type: 'session_event',
              event: {
                projectId,
                sdkSessionId: sdkSessionId ?? 'pending',
                timestamp: new Date().toISOString(),
                payload: { type: 'diff_snapshot', diff },
              },
            });
          }
        },
        (err: unknown) => {
          send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        },
      );
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
