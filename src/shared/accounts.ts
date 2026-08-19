export interface AccountPublic {
  provider: "claude" | "codex" | "copilot" | "grok-build";
  connected: boolean;
  kind?: "oauth" | "pat";
  label?: string;
  updatedAt?: number;
}

export interface AccountRecord {
  provider: AccountPublic["provider"];
  kind: "oauth" | "pat";
  accessToken: string;
  refreshToken?: string;
  label?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GithubAppCreds {
  clientId: string;
  clientSecret: string;
}

export interface OauthState {
  provider: AccountRecord["provider"];
  createdAt: number;
}
