import "server-only"
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto"

// Symmetric encryption for admin-recoverable secrets (currently: a recoverable
// copy of each user's password so the system owner can reveal it in the panel).
//
// We use AES-256-GCM, an authenticated cipher: it both hides the value and
// detects tampering. The 32-byte key is derived from BETTER_AUTH_SECRET via
// SHA-256, so no extra env var is needed. Ciphertext is stored as a single
// string "iv:authTag:data", all base64. This is reversible by design — unlike
// the login hash — because the requirement is for the admin to read the value.

const KEY = createHash("sha256")
  .update(process.env.BETTER_AUTH_SECRET || "camvex-fallback-key-change-me")
  .digest() // 32 bytes

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12) // 96-bit nonce recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":")
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()])
    return dec.toString("utf8")
  } catch {
    // Wrong key, corrupted value, or legacy format — fail closed.
    return null
  }
}
