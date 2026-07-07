/**
 * Cloud-agnostic object storage boundary. S3Provider is the v1 implementation;
 * an AzureBlobProvider can be added later behind this same interface without
 * touching callers in agent-runtime or control-plane.
 */
export interface StorageProvider {
  put(key: string, body: Buffer | string, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
