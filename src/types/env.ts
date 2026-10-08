export interface Env {
  AUTH_SECRET: string;
  BOOTSTRAP_SECRET?: string;
  DB?: D1Database;
  SECURITY_KV?: KVNamespace;
}
