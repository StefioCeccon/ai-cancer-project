import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for secrets stored in the DB (per-user AI API keys).
 *
 * AES-256-GCM. The 32-byte key is derived from `API_KEY_ENCRYPTION_SECRET` via
 * SHA-256, so any sufficiently random secret string works. Ciphertext is stored as
 * `iv:authTag:data` (all base64). We never store plaintext keys.
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET is not set (or too short). Set a long random string to store API keys.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** True when the encryption secret is configured (so key management is usable). */
export function isEncryptionConfigured(): boolean {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  return !!secret && secret.length >= 16;
}
