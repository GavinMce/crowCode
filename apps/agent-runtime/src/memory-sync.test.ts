import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StorageProvider } from '@crowcode/storage';
import { downloadMemory, uploadMemory } from './memory-sync.js';

/** In-memory double for StorageProvider -- same pattern as s3-session-store.test.ts. */
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

describe('memory-sync', () => {
  let localDir: string;

  beforeEach(async () => {
    localDir = await mkdtemp(join(tmpdir(), 'crowcode-memory-test-'));
  });

  afterEach(async () => {
    await rm(localDir, { recursive: true, force: true });
  });

  it('downloadMemory is a no-op when nothing was ever uploaded for this project', async () => {
    await downloadMemory(new FakeStorageProvider(), 'project-1', localDir);
    const uploaded = await uploadMemory(new FakeStorageProvider(), 'project-1', localDir);
    expect(uploaded).toEqual([]);
  });

  it('round-trips a file through upload then download into a fresh directory', async () => {
    const storage = new FakeStorageProvider();
    await writeFile(join(localDir, 'notes.md'), '# durable facts\n- likes tabs');

    const uploaded = await uploadMemory(storage, 'project-1', localDir);
    expect(uploaded).toEqual(['notes.md']);

    const freshDir = await mkdtemp(join(tmpdir(), 'crowcode-memory-test-'));
    try {
      await downloadMemory(storage, 'project-1', freshDir);
      const content = await readFile(join(freshDir, 'notes.md'), 'utf8');
      expect(content).toBe('# durable facts\n- likes tabs');
    } finally {
      await rm(freshDir, { recursive: true, force: true });
    }
  });

  it('keeps different projects isolated under separate key prefixes', async () => {
    const storage = new FakeStorageProvider();
    await writeFile(join(localDir, 'notes.md'), 'project-a memory');
    await uploadMemory(storage, 'project-a', localDir);

    const projectBDir = await mkdtemp(join(tmpdir(), 'crowcode-memory-test-'));
    try {
      await downloadMemory(storage, 'project-b', projectBDir);
      await expect(readFile(join(projectBDir, 'notes.md'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(projectBDir, { recursive: true, force: true });
    }
  });

  it('uploads nested subdirectories preserving relative paths', async () => {
    const storage = new FakeStorageProvider();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(localDir, 'sub'), { recursive: true });
    await writeFile(join(localDir, 'sub', 'deep.md'), 'nested fact');

    const uploaded = await uploadMemory(storage, 'project-1', localDir);
    expect(uploaded.sort()).toEqual(['sub/deep.md']);
  });
});
