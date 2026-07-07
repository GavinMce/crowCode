import { randomUUID } from 'node:crypto';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { beforeAll, describe, expect, it } from 'vitest';
import { S3Provider } from './s3-provider.js';

/**
 * Integration test against a real S3-compatible endpoint (MinIO in CI/local
 * dev, see docker-compose.dev.yml). Not mocked -- this is the thing that
 * would silently drift from real S3 semantics if we faked it.
 */
const bucket = process.env.S3_BUCKET ?? 'crowcode-dev';
const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const region = process.env.S3_REGION ?? 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? 'crowcode';
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? 'crowcode-dev-secret';

beforeAll(async () => {
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}, 30_000);

describe('S3Provider', () => {
  const storage = new S3Provider({
    bucket,
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  it('round-trips put/get/exists/delete for a single key', async () => {
    const key = `test/${randomUUID()}.txt`;
    expect(await storage.exists(key)).toBe(false);

    await storage.put(key, 'hello crowcode');
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.get(key))?.toString('utf8')).toBe('hello crowcode');

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('returns null from get() for a key that was never written', async () => {
    const key = `test/${randomUUID()}-missing.txt`;
    expect(await storage.get(key)).toBeNull();
  });

  it('lists all keys under a prefix', async () => {
    const prefix = `test/${randomUUID()}/`;
    await Promise.all([
      storage.put(`${prefix}a.txt`, 'a'),
      storage.put(`${prefix}b.txt`, 'b'),
      storage.put(`${prefix}nested/c.txt`, 'c'),
    ]);

    const keys = await storage.list(prefix);
    expect(keys.sort()).toEqual([`${prefix}a.txt`, `${prefix}b.txt`, `${prefix}nested/c.txt`].sort());
  });
});
