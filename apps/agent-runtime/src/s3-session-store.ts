import type { StorageProvider } from '@crowcode/storage';
import type { SessionKey, SessionStore, SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk';

function mainKey(key: { projectKey: string; sessionId: string }): string {
  return `sdk-session-store/${key.projectKey}/${key.sessionId}.jsonl`;
}

function subKey(key: SessionKey): string {
  return key.subpath
    ? `sdk-session-store/${key.projectKey}/${key.sessionId}/${key.subpath}.jsonl`
    : mainKey(key);
}

async function readEntries(storage: StorageProvider, path: string): Promise<SessionStoreEntry[] | null> {
  const buf = await storage.get(path);
  if (!buf) return null;
  const text = buf.toString('utf8').trim();
  if (!text) return [];
  return text.split('\n').map((line) => JSON.parse(line) as SessionStoreEntry);
}

/**
 * SDK SessionStore adapter backed by our StorageProvider (S3). This is what
 * makes "resume from anywhere" work: every agent-runtime container, in any
 * sandbox, points at the same bucket, so `query({ resume, sessionStore })`
 * materializes history regardless of which container produced it.
 *
 * v1 implements only append/load/listSubkeys -- the three calls the SDK
 * actually needs to mirror and resume a session. listSessions/delete are
 * left unimplemented (both optional on SessionStore) until there's a
 * session-browser UI feature that needs them.
 */
export function createS3SessionStore(storage: StorageProvider): SessionStore {
  return {
    async append(key, entries) {
      const path = subKey(key);
      const existing = (await readEntries(storage, path)) ?? [];
      const merged = existing.concat(entries);
      const body = merged.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await storage.put(path, body, { contentType: 'application/x-ndjson' });
    },

    async load(key) {
      return readEntries(storage, subKey(key));
    },

    async listSubkeys(key) {
      const prefix = `sdk-session-store/${key.projectKey}/${key.sessionId}/`;
      const keys = await storage.list(prefix);
      return keys
        .filter((k) => k.endsWith('.jsonl'))
        .map((k) => k.slice(prefix.length, -'.jsonl'.length));
    },
  };
}
