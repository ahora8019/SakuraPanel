const encoder = new TextEncoder();
const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const FORMAT = "pbkdf2-sha256$v1";

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_credential_format");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Creates a versioned PBKDF2-SHA-256 credential string; never stores plaintext. */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new Error("password_policy_failed");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [FORMAT, String(ITERATIONS), encodeBase64Url(salt), encodeBase64Url(hash)].join("$");
}

/** Returns false for malformed/unsupported encodings and invalid passwords. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (typeof password !== "string" || password.length > 256 || typeof encoded !== "string" || encoded.length > 256) {
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2-sha256" || parts[1] !== "v1") return false;
  const iterations = Number(parts[2]);
  // Bound attacker-controlled work if a credential value is corrupted in storage.
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 600_000) return false;
  try {
    const salt = decodeBase64Url(parts[3]);
    const expected = decodeBase64Url(parts[4]);
    if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) return false;
    const actual = await derive(password, salt, iterations);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
    return difference === 0;
  } catch {
    return false;
  }
}
