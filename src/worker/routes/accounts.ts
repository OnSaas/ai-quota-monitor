import type { Provider } from "../../shared/types";
import type { AppEnv } from "../auth";
import { deleteAccount, getGithubApp, listAccounts, putAccount } from "../accounts";
import { unwrapAqm1, wrapSecret } from "../crypto";

const PROVIDERS: Provider[] = ["copilot", "grok-build", "claude", "codex"];

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

export async function handleAccountsGet(env: AppEnv): Promise<Response> {
  const github = await getGithubApp(env);
  return Response.json({
    accounts: await listAccounts(env),
    githubOauthReady: Boolean(github),
  });
}

export async function handleAccountsPut(request: Request, env: AppEnv): Promise<Response> {
  const body = (await request.json()) as { provider?: unknown; wrapped?: unknown; token?: unknown };
  if (!isProvider(body.provider)) {
    return Response.json({ error: "provider required" }, { status: 400 });
  }
  if (typeof body.token === "string") {
    return Response.json({ error: "plaintext token rejected; send wrapped AQMv1 payload" }, { status: 400 });
  }
  if (typeof body.wrapped !== "string" || !body.wrapped.startsWith("AQMv1.")) {
    return Response.json({ error: "wrapped AQMv1 payload required" }, { status: 400 });
  }

  let inner: { token?: string; kind?: string; label?: string; refreshToken?: string };
  try {
    inner = await unwrapAqm1(wrapSecret(env), body.wrapped);
  } catch {
    return Response.json({ error: "cannot unwrap credential" }, { status: 400 });
  }
  if (!inner.token?.trim()) {
    return Response.json({ error: "wrapped payload missing token" }, { status: 400 });
  }

  const now = Date.now();
  await putAccount(env, {
    provider: body.provider,
    kind: inner.kind === "oauth" ? "oauth" : "pat",
    accessToken: inner.token.trim(),
    refreshToken: inner.refreshToken,
    label: inner.label,
    createdAt: now,
    updatedAt: now,
  });
  return handleAccountsGet(env);
}

export async function handleAccountsDelete(env: AppEnv, provider: string): Promise<Response> {
  if (!isProvider(provider)) return Response.json({ error: "unknown provider" }, { status: 400 });
  await deleteAccount(env, provider);
  return handleAccountsGet(env);
}
