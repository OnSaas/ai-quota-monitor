import type { Provider } from "../../shared/types";
import type { AppEnv } from "../auth";
import { deleteAccount, getGithubApp, listAccounts, putAccount } from "../accounts";

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
  const body = (await request.json()) as { provider?: unknown; token?: unknown; kind?: unknown; label?: unknown };
  if (!isProvider(body.provider) || typeof body.token !== "string" || !body.token.trim()) {
    return Response.json({ error: "provider and token required" }, { status: 400 });
  }
  const now = Date.now();
  await putAccount(env, {
    provider: body.provider,
    kind: body.kind === "oauth" ? "oauth" : "pat",
    accessToken: body.token.trim(),
    label: typeof body.label === "string" ? body.label : undefined,
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
