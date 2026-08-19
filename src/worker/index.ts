import type { AppEnv } from "./auth";
import { requireToken } from "./auth";
import { runCron } from "./cron";
import { handleConfigGet, handleConfigPut } from "./routes/config";
import { handleNotifyTest } from "./routes/notify-test";
import { handlePush } from "./routes/push";
import { handleSummary } from "./routes/summary";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function handleApi(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/v1/push" && request.method === "POST") {
    const denied = await requireToken(request, env.PUSH_TOKEN, "PUSH_TOKEN");
    if (denied) return denied;
    return handlePush(request, env);
  }

  if (path === "/v1/summary" && request.method === "GET") {
    const denied = await requireToken(request, env.ADMIN_TOKEN, "ADMIN_TOKEN");
    if (denied) return denied;
    return handleSummary(env);
  }

  if (path === "/v1/config" && request.method === "GET") {
    const denied = await requireToken(request, env.ADMIN_TOKEN, "ADMIN_TOKEN");
    if (denied) return denied;
    return handleConfigGet(env);
  }

  if (path === "/v1/config" && request.method === "PUT") {
    const denied = await requireToken(request, env.ADMIN_TOKEN, "ADMIN_TOKEN");
    if (denied) return denied;
    return handleConfigPut(request, env);
  }

  if (path === "/v1/notify-test" && request.method === "POST") {
    const denied = await requireToken(request, env.ADMIN_TOKEN, "ADMIN_TOKEN");
    if (denied) return denied;
    return handleNotifyTest(env);
  }

  if (path === "/v1/cron" && request.method === "POST") {
    const denied = await requireToken(request, env.ADMIN_TOKEN, "ADMIN_TOKEN");
    if (denied) return denied;
    await runCron(env);
    return Response.json({ ok: true });
  }

  if (path.startsWith("/v1/")) {
    return jsonError("not found", 404);
  }

  return jsonError("not found", 404);
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/v1/")) {
        return await handleApi(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(JSON.stringify({ message: "unhandled error", error: message, path: new URL(request.url).pathname }));
      return jsonError("internal server error", 500);
    }
  },

  async scheduled(_controller: ScheduledController, env: AppEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
} satisfies ExportedHandler<AppEnv>;
