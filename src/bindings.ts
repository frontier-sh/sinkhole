export type Bindings = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
  REALTIME: DurableObjectNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_ALLOWED_ORG: string;
  GITHUB_ALLOWED_TEAM?: string;
  DISABLE_AUTH?: string;
};
