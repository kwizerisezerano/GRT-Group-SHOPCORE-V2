import crypto from "node:crypto";
import { env } from "../config/env";

/**
 * Application-level encryption for personally identifiable information.
 *
 * Two independent keys, both 32 bytes supplied as 64 hex characters:
 *
 *   ENCRYPTION_KEY   AES-256-GCM data key. Confidentiality + integrity.
 *   BLIND_INDEX_KEY  HMAC-SHA256 key for deterministic lookup hashes.
 *
 * They must never be the same value. Reusing one key for both a cipher and a
 * MAC leaks structure, and the blind index is deliberately deterministic
 * while the cipher is deliberately not — mixing them would undo that.
 *
 * Why both, rather than encryption alone: AES-GCM output is randomised by a
 * fresh IV on every call, so the same email encrypts to a different string
 * each time. That is what we want for confidentiality, but it makes the
 * column useless for `WHERE email = ?` and impossible to constrain with a
 * UNIQUE index. The blind index is a keyed, deterministic fingerprint of the
 * *normalised* value: equal inputs produce equal hashes, so MySQL can index
 * it, enforce uniqueness on it, and answer exact-match lookups — without the
 * column ever holding readable data. Because it is keyed, an attacker with
 * the database but not BLIND_INDEX_KEY cannot test candidate emails against
 * it the way they could with a plain SHA-256.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce — the size GCM is specified around
const KEY_BYTES = 32;
const ENVELOPE_VERSION = "v1";

function loadKey(hex: string, name: string): Buffer {
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(`${name} must be ${KEY_BYTES} bytes encoded as ${KEY_BYTES * 2} hex characters`);
  }
  return key;
}

const encryptionKey = loadKey(env.ENCRYPTION_KEY, "ENCRYPTION_KEY");
const blindIndexKey = loadKey(env.BLIND_INDEX_KEY, "BLIND_INDEX_KEY");

if (encryptionKey.equals(blindIndexKey)) {
  throw new Error("ENCRYPTION_KEY and BLIND_INDEX_KEY must be different values");
}

/**
 * AES-256-GCM encrypt. Output is a self-describing envelope:
 *
 *   v1.<iv>.<authTag>.<ciphertext>     (each part base64url)
 *
 * The version prefix exists so a future key rotation or algorithm change can
 * be rolled out by writing v2 while still reading v1.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Reverses `encrypt`. Throws if the envelope is malformed, or if the
 * authentication tag does not verify — which is what makes GCM preferable to
 * CBC here: tampered ciphertext fails loudly instead of decrypting to
 * plausible garbage.
 */
export function decrypt(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed ciphertext envelope");
  }

  const [version, ivPart, tagPart, ciphertextPart] = parts;
  if (version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported ciphertext envelope version: ${version}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptNullable(plaintext: string | null | undefined): string | null {
  return plaintext === null || plaintext === undefined || plaintext === "" ? null : encrypt(plaintext);
}

/**
 * Decrypts a stored value, returning null rather than throwing when the
 * column is empty. A value that is present but undecryptable is a real
 * problem (wrong key, corruption, tampering) and is allowed to throw.
 */
export function decryptNullable(envelope: string | null | undefined): string | null {
  return envelope === null || envelope === undefined || envelope === "" ? null : decrypt(envelope);
}

/**
 * Normalises an email for hashing so that trivial presentation differences
 * do not defeat the uniqueness constraint: `Ada@Shop.io ` and `ada@shop.io`
 * must collide. Only case and surrounding whitespace are folded — the local
 * part is left otherwise intact, since dot- and plus-stripping are
 * provider-specific conventions, not rules, and applying them would wrongly
 * merge distinct accounts on providers that treat them as significant.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalises a phone number to digits, preserving a leading `+`, so that
 * "+250 788 123 456", "+250-788-123-456" and "+250788123456" share one hash.
 * Numbers written in different international formats (0788… vs +250788…)
 * still hash differently; normalising those apart requires a region and is
 * left to the caller.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/** Keyed, deterministic HMAC-SHA256 fingerprint. 64 hex characters. */
export function blindIndex(value: string): string {
  return crypto.createHmac("sha256", blindIndexKey).update(value, "utf8").digest("hex");
}

export function emailBlindIndex(email: string): string {
  return blindIndex(`email:${normalizeEmail(email)}`);
}

export function phoneBlindIndex(phone: string): string {
  return blindIndex(`phone:${normalizePhone(phone)}`);
}

export function emailBlindIndexNullable(email: string | null | undefined): string | null {
  return email === null || email === undefined || email === "" ? null : emailBlindIndex(email);
}

export function phoneBlindIndexNullable(phone: string | null | undefined): string | null {
  return phone === null || phone === undefined || phone === "" ? null : phoneBlindIndex(phone);
}
