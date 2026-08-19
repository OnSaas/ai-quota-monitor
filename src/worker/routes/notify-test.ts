import type { AppEnv } from "../auth";
import { getConfig } from "../kv";
import { sendWebhook } from "../notify";

export async function handleNotifyTest(env: AppEnv): Promise<Response> {
  const config = await getConfig(env);
  const result = await sendWebhook(config, {
    title: "AQM · test notification",
    body: "If you can read this, webhook delivery from the Worker works.",
    kind: "test",
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
