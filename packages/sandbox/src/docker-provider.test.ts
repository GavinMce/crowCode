import Docker from 'dockerode';
import { beforeAll, describe, expect, it } from 'vitest';
import { DockerSandboxProvider } from './docker-provider.js';

/**
 * Integration test against a real Docker daemon (the point of this provider
 * is talking to Docker -- mocking dockerode would just test our mock).
 * Uses nginx:alpine because its default CMD runs in the foreground
 * indefinitely, so we can observe a real 'running' state without extending
 * SandboxSpec with a custom command field.
 */
const TEST_IMAGE = 'nginx:alpine';

function waitFor(condition: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await condition()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 200);
    };
    void tick();
  });
}

beforeAll(async () => {
  const docker = new Docker();
  await new Promise<void>((resolve, reject) => {
    docker.pull(TEST_IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (progressErr) => (progressErr ? reject(progressErr) : resolve()));
    });
  });
}, 60_000);

describe('DockerSandboxProvider', () => {
  const provider = new DockerSandboxProvider();

  it('creates, starts, stops, and destroys a container, observing real state transitions', async () => {
    const handle = await provider.create({
      projectId: 'test-project',
      image: TEST_IMAGE,
      env: { CROWCODE_TEST: 'true' },
    });
    expect(await handle.status()).toBe('starting');

    await provider.start(handle.id);
    await waitFor(async () => (await handle.status()) === 'running');

    await provider.stop(handle.id);
    await waitFor(async () => (await handle.status()) === 'stopped');

    await provider.destroy(handle.id);
    expect(await provider.get(handle.id)).toBeNull();
  }, 30_000);

  it('get() returns null for an id that was never created', async () => {
    expect(await provider.get('not-a-real-container-id')).toBeNull();
  });
});
