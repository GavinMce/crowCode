import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
} from '@aws-sdk/client-s3';
import type { StorageProvider } from './types.js';

export interface S3ProviderConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/**
 * S3-compatible StorageProvider. Works unmodified against MinIO in local dev
 * by setting `endpoint` + `forcePathStyle: true`.
 */
export class S3Provider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3ProviderConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region ?? 'us-east-1',
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
    });
  }

  async put(key: string, body: Buffer | string, opts?: { contentType?: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts?.contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of result.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (err instanceof NotFound) return false;
      throw err;
    }
  }
}
