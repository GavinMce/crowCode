import Docker from 'dockerode';
import type { SandboxHandle, SandboxProvider, SandboxSpec, SandboxStatus } from './types.js';

export interface DockerSandboxProviderConfig {
  /** Unix socket path for a local daemon, e.g. "/var/run/docker.sock". */
  socketPath?: string;
  /** Remote Docker host, e.g. for a Docker daemon exposed over TLS. */
  host?: string;
  port?: number;
  ca?: string;
  cert?: string;
  key?: string;
}

function toDockerState(state: Docker.ContainerInspectInfo['State'] | undefined): SandboxStatus {
  if (!state) return 'error';
  if (state.Running) return 'running';
  if (state.Status === 'created') return 'starting';
  if (state.Status === 'exited' || state.Status === 'dead') return 'stopped';
  return 'error';
}

class DockerSandboxHandle implements SandboxHandle {
  constructor(
    public readonly id: string,
    private readonly docker: Docker,
  ) {}

  async status(): Promise<SandboxStatus> {
    const info = await this.docker.getContainer(this.id).inspect();
    return toDockerState(info.State);
  }
}

/**
 * v1 SandboxProvider: creates one Docker container per project. Point
 * `config` at a local Unix socket for dev, or a remote Docker host (TCP+TLS)
 * to move compute off the user's laptop -- the SandboxProvider interface
 * itself does not change between the two.
 */
export class DockerSandboxProvider implements SandboxProvider {
  private readonly docker: Docker;

  constructor(config: DockerSandboxProviderConfig = {}) {
    this.docker = new Docker(
      config.host
        ? { host: config.host, port: config.port, ca: config.ca, cert: config.cert, key: config.key }
        : { socketPath: config.socketPath ?? '/var/run/docker.sock' },
    );
  }

  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    const env = Object.entries(spec.env).map(([k, v]) => `${k}=${v}`);
    const container = await this.docker.createContainer({
      Image: spec.image,
      Env: env,
      Labels: { 'crowcode.projectId': spec.projectId },
      HostConfig: {
        ExtraHosts: ['host.docker.internal:host-gateway'],
        ...(spec.volume ? { Binds: [`${spec.volume.name}:${spec.volume.mountPath}`] } : {}),
      },
    });
    return new DockerSandboxHandle(container.id, this.docker);
  }

  async start(id: string): Promise<void> {
    await this.docker.getContainer(id).start();
  }

  async stop(id: string): Promise<void> {
    await this.docker.getContainer(id).stop();
  }

  async destroy(id: string): Promise<void> {
    await this.docker.getContainer(id).remove({ force: true });
  }

  async get(id: string): Promise<SandboxHandle | null> {
    try {
      await this.docker.getContainer(id).inspect();
      return new DockerSandboxHandle(id, this.docker);
    } catch {
      return null;
    }
  }
}
