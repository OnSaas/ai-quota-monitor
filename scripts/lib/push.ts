import type { Snapshot } from "../../src/shared/types";
import { env } from "./http";

export async function pushSnapshot(snapshot: Snapshot): Promise<void> {
  const url = env("WORKER_PUSH_URL");
  const token = env("PUSH_TOKEN");
  if (!url || !token) {
    throw new Error("WORKER_PUSH_URL and PUSH_TOKEN are required to push");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`push ${snapshot.provider} failed: ${res.status} ${text.slice(0, 300)}`);
  }
}

export function ghSummary(lines: string[]): void {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) {
    console.log(lines.join("\n"));
    return;
  }
  const { appendFileSync } = require("node:fs") as typeof import("node:fs");
  appendFileSync(path, `${lines.join("\n")}\n`);
}
