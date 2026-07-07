import { describe, expect, it } from 'vitest';
import type { StorageProvider } from '@crowcode/storage';
import { createS3SessionStore } from './s3-session-store.js';

/** In-memory double for StorageProvider -- the S3-specific behavior itself is covered by packages/storage's real MinIO test. */
class FakeStorageProvider implements StorageProvider {
  private readonly files = new Map<string, Buffer>();

  async put(key: string, body: Buffer | string): Promise<void> {
    this.files.set(key, Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'));
  }
  async get(key: string): Promise<Buffer | null> {
    return this.files.get(key) ?? null;
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((k) => k.startsWith(prefix));
  }
  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }
}

describe('createS3SessionStore', () => {
  it('returns null from load() for a session that was never appended to', async () => {
    const store = createS3SessionStore(new FakeStorageProvider());
    const result = await store.load({ projectKey: 'project-1', sessionId: 'session-1' });
    expect(result).toBeNull();
  });

  it('accumulates entries across multiple append() calls', async () => {
    const store = createS3SessionStore(new FakeStorageProvider());
    const key = { projectKey: 'project-1', sessionId: 'session-1' };

    await store.append(key, [{ type: 'user', uuid: 'a' }]);
    await store.append(key, [{ type: 'assistant', uuid: 'b' }]);

    const result = await store.load(key);
    expect(result).toEqual([
      { type: 'user', uuid: 'a' },
      { type: 'assistant', uuid: 'b' },
    ]);
  });

  it('keeps subagent transcripts (subpath) separate from the main transcript', async () => {
    const store = createS3SessionStore(new FakeStorageProvider());
    const mainKey = { projectKey: 'project-1', sessionId: 'session-1' };
    const subKey = { ...mainKey, subpath: 'subagents/agent-xyz' };

    await store.append(mainKey, [{ type: 'user', uuid: 'main-1' }]);
    await store.append(subKey, [{ type: 'assistant', uuid: 'sub-1' }]);

    expect(await store.load(mainKey)).toEqual([{ type: 'user', uuid: 'main-1' }]);
    expect(await store.load(subKey)).toEqual([{ type: 'assistant', uuid: 'sub-1' }]);
  });

  it('listSubkeys() discovers subagent transcript subpaths under a session', async () => {
    const store = createS3SessionStore(new FakeStorageProvider());
    const mainKey = { projectKey: 'project-1', sessionId: 'session-1' };

    await store.append(mainKey, [{ type: 'user', uuid: 'main-1' }]);
    await store.append({ ...mainKey, subpath: 'subagents/agent-a' }, [{ type: 'assistant', uuid: 'a' }]);
    await store.append({ ...mainKey, subpath: 'subagents/agent-b' }, [{ type: 'assistant', uuid: 'b' }]);

    const subkeys = await store.listSubkeys!(mainKey);
    expect(subkeys.sort()).toEqual(['subagents/agent-a', 'subagents/agent-b']);
  });
});
