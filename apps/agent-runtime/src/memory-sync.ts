import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { StorageProvider } from '@crowcode/storage';

/**
 * Outside the git-tracked repo dir so memory never shows up in commits or
 * the diff panel. The SDK sandboxes tool access to `cwd` by default, so
 * this must be added via `additionalDirectories` in orchestrator.ts's
 * query() call, or Read/Write/Edit tools can't reach it -- confirmed by
 * hand: the agent explicitly reported being blocked from writing here
 * before that option was added.
 */
export const MEMORY_DIR = '/workspace/.crowcode-memory';

function memoryPrefix(projectKey: string): string {
  return `memory/${projectKey}/`;
}

/**
 * Downloads every previously-saved auto-memory file for this project into
 * localDir. Auto-memory itself is the SDK's own feature (see
 * `autoMemoryDirectory` in Settings) -- this is only the sync layer that
 * makes it survive past a single ephemeral session container, keyed by
 * project (not session) so later sessions inherit earlier ones' memory.
 */
export async function downloadMemory(storage: StorageProvider, projectKey: string, localDir: string): Promise<void> {
  await mkdir(localDir, { recursive: true });
  const prefix = memoryPrefix(projectKey);
  const keys = await storage.list(prefix);
  for (const key of keys) {
    const content = await storage.get(key);
    if (!content) continue;
    const relativePath = key.slice(prefix.length);
    if (!relativePath) continue;
    const localPath = join(localDir, relativePath);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, content);
  }
}

/** Uploads every file currently in localDir back to S3. Returns the relative paths uploaded. */
export async function uploadMemory(
  storage: StorageProvider,
  projectKey: string,
  localDir: string,
): Promise<string[]> {
  const prefix = memoryPrefix(projectKey);
  let entries: string[];
  try {
    entries = await readdir(localDir, { recursive: true });
  } catch {
    return [];
  }

  const uploaded: string[] = [];
  for (const relativePath of entries) {
    const localPath = join(localDir, relativePath);
    const info = await stat(localPath);
    if (!info.isFile()) continue;
    const content = await readFile(localPath);
    await storage.put(prefix + relativePath, content);
    uploaded.push(relativePath);
  }
  return uploaded;
}
