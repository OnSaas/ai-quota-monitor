function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJson(secret: string, value: unknown): Promise<string> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({ iv: b64(iv), data: b64(cipher) });
}

export async function decryptJson<T>(secret: string, packed: string): Promise<T> {
  const parsed = JSON.parse(packed) as { iv: string; data: string };
  const key = await aesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(parsed.iv) },
    key,
    fromB64(parsed.data),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export function wrapSecret(env: { ADMIN_TOKEN?: string }): string {
  if (!env.ADMIN_TOKEN) throw new Error("ADMIN_TOKEN is required to wrap account credentials");
  return env.ADMIN_TOKEN;
}
