import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  blindIndex,
  decrypt,
  decryptNullable,
  emailBlindIndex,
  encrypt,
  encryptNullable,
  normalizeEmail,
  normalizePhone,
  phoneBlindIndex,
  phoneBlindIndexNullable,
} from "./crypto";

describe("encrypt / decrypt (AES-256-GCM)", () => {
  it("round-trips a value", () => {
    expect(decrypt(encrypt("ada@shopcore.io"))).toBe("ada@shopcore.io");
  });

  it("round-trips unicode and emoji without corruption", () => {
    const value = "Ndayishimiye Jean-Baptiste — Kigali 🇷🇼";
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it("round-trips an empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("produces different ciphertext for the same plaintext each time", () => {
    // A fresh random IV per call. This is why the encrypted column cannot be
    // used for lookups or uniqueness — that is the blind index's job.
    const a = encrypt("ada@shopcore.io");
    const b = encrypt("ada@shopcore.io");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("never leaks the plaintext into the envelope", () => {
    expect(encrypt("ada@shopcore.io")).not.toContain("ada");
  });

  it("emits a versioned four-part envelope", () => {
    const parts = encrypt("value").split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    // 12-byte IV and 16-byte tag, base64url encoded.
    expect(Buffer.from(parts[1], "base64url")).toHaveLength(12);
    expect(Buffer.from(parts[2], "base64url")).toHaveLength(16);
  });

  it("rejects ciphertext whose payload was tampered with", () => {
    // The point of GCM over CBC: modification is detected rather than
    // decrypting to plausible garbage.
    const [version, iv, tag, ciphertext] = encrypt("balance: 100").split(".");
    const flipped = Buffer.from(ciphertext, "base64url");
    flipped[0] ^= 0x01;
    expect(() => decrypt([version, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("rejects ciphertext whose auth tag was tampered with", () => {
    const [version, iv, tag, ciphertext] = encrypt("balance: 100").split(".");
    const flipped = Buffer.from(tag, "base64url");
    flipped[0] ^= 0x01;
    expect(() => decrypt([version, iv, flipped.toString("base64url"), ciphertext].join("."))).toThrow();
  });

  it("rejects a value encrypted under a different key", () => {
    const foreignKey = Buffer.alloc(32, 9);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", foreignKey, iv);
    const ct = Buffer.concat([cipher.update("secret", "utf8"), cipher.final()]);
    const envelope = [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ct.toString("base64url"),
    ].join(".");

    expect(() => decrypt(envelope)).toThrow();
  });

  it("rejects a malformed envelope", () => {
    expect(() => decrypt("not-an-envelope")).toThrow(/Malformed/);
  });

  it("rejects an unknown envelope version", () => {
    const envelope = encrypt("value").replace(/^v1/, "v99");
    expect(() => decrypt(envelope)).toThrow(/Unsupported/);
  });
});

describe("nullable helpers", () => {
  it("maps null, undefined and empty string to null", () => {
    expect(encryptNullable(null)).toBeNull();
    expect(encryptNullable(undefined)).toBeNull();
    expect(encryptNullable("")).toBeNull();
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable(undefined)).toBeNull();
    expect(decryptNullable("")).toBeNull();
  });

  it("round-trips a present value", () => {
    expect(decryptNullable(encryptNullable("+250788123456"))).toBe("+250788123456");
  });
});

describe("blind index (HMAC-SHA256)", () => {
  it("is deterministic", () => {
    expect(blindIndex("value")).toBe(blindIndex("value"));
  });

  it("returns 64 hex characters", () => {
    expect(blindIndex("value")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("separates different values", () => {
    expect(blindIndex("a")).not.toBe(blindIndex("b"));
  });

  it("domain-separates emails from phones", () => {
    // Same raw string in two roles must not collide, so a phone can never
    // satisfy an email uniqueness check.
    expect(emailBlindIndex("12345")).not.toBe(phoneBlindIndex("12345"));
  });

  it("is not a bare SHA-256 of the value", () => {
    // Proves the index is keyed. An unkeyed digest would let anyone holding
    // the database test candidate emails offline.
    const bare = crypto.createHash("sha256").update("ada@shopcore.io").digest("hex");
    expect(emailBlindIndex("ada@shopcore.io")).not.toBe(bare);
  });
});

describe("email normalisation", () => {
  it("folds case and surrounding whitespace", () => {
    expect(normalizeEmail("  Ada@ShopCore.IO ")).toBe("ada@shopcore.io");
  });

  it("collides on values that differ only by case or padding", () => {
    expect(emailBlindIndex("Ada@ShopCore.IO")).toBe(emailBlindIndex("ada@shopcore.io"));
    expect(emailBlindIndex(" ada@shopcore.io ")).toBe(emailBlindIndex("ada@shopcore.io"));
  });

  it("keeps dots and plus tags significant", () => {
    // Gmail treats these as equivalent; the standard does not, and other
    // providers do not. Folding them would merge unrelated accounts.
    expect(emailBlindIndex("a.da@shopcore.io")).not.toBe(emailBlindIndex("ada@shopcore.io"));
    expect(emailBlindIndex("ada+shop@shopcore.io")).not.toBe(emailBlindIndex("ada@shopcore.io"));
  });
});

describe("phone normalisation", () => {
  it("strips formatting while preserving a leading plus", () => {
    expect(normalizePhone("+250 788 123 456")).toBe("+250788123456");
    expect(normalizePhone("+250-788-123-456")).toBe("+250788123456");
    expect(normalizePhone("(0788) 123 456")).toBe("0788123456");
  });

  it("collides across formatting variants of one number", () => {
    expect(phoneBlindIndex("+250 788 123 456")).toBe(phoneBlindIndex("+250788123456"));
  });

  it("keeps national and international forms distinct", () => {
    // Reconciling 0788… with +250788… needs a region, which this layer does
    // not have. Documented rather than silently guessed.
    expect(phoneBlindIndex("0788123456")).not.toBe(phoneBlindIndex("+250788123456"));
  });

  it("maps absent values to null", () => {
    expect(phoneBlindIndexNullable(null)).toBeNull();
    expect(phoneBlindIndexNullable("")).toBeNull();
    expect(phoneBlindIndexNullable("+250788123456")).toMatch(/^[0-9a-f]{64}$/);
  });
});
