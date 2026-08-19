export type AppEnv = Env & {
  PUSH_TOKEN?: string;
  ADMIN_TOKEN?: string;
};

function bytesEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function tokensEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return bytesEqual(left, right);
}

function bearer(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function requireToken(
  request: Request,
  expected: string | undefined,
  label: string,
): Promise<Response | null> {
  if (!expected) {
    return Response.json({ error: `${label} is not configured on the Worker` }, { status: 503 });
  }
  const token = bearer(request) ?? request.headers.get("X-AQM-Token");
  if (!token) {
    return Response.json({ error: "missing token" }, { status: 401 });
  }
  const ok = await tokensEqual(token, expected);
  if (!ok) {
    return Response.json({ error: "invalid token" }, { status: 401 });
  }
  return null;
}
