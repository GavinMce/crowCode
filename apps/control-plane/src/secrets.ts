import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Envelope encryption for git PATs at rest in the project registry DB.
 * v1-minimum bar per the architecture plan -- migrate to a real secrets
 * manager (Vault/AWS Secrets Manager) before multi-tenant deployment.
 * Key must be a 32-byte value, base64-encoded, in CONTROL_PLANE_SECRET_KEY.
 */
function loadKey(): Buffer {
  const b64 = process.env.CONTROL_PLANE_SECRET_KEY;
  if (!b64) throw new Error('Missing required env var CONTROL_PLANE_SECRET_KEY (32 bytes, base64)');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('CONTROL_PLANE_SECRET_KEY must decode to exactly 32 bytes');
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
