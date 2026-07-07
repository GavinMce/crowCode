export type SandboxStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface SandboxSpec {
  projectId: string;
  /** e.g. "crowcode/agent-runtime-base:1" */
  image: string;
  /** Injected into the container, e.g. control-plane URL, project id, short-lived git credential. */
  env: Record<string, string>;
  volume?: { name: string; mountPath: string };
}

export interface SandboxHandle {
  id: string;
  status(): Promise<SandboxStatus>;
}

/**
 * Compute boundary: v1 implementation (DockerSandboxProvider) points at a
 * local or remote Docker host. Swapping to a different backend (a managed
 * container platform, Kubernetes, etc.) means writing a new implementation
 * of this interface, not touching callers in control-plane.
 */
export interface SandboxProvider {
  create(spec: SandboxSpec): Promise<SandboxHandle>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  get(id: string): Promise<SandboxHandle | null>;
}
