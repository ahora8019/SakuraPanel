export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "REVOKE"
  | "ADMIN_ACTION"
  | "SECURITY_EVENT";

export interface AuditEvent {
  id: string;
  actorId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "authorization",
  "apikey",
  "privatekey",
  "credential",
  "cookie"
] as const;

export function sanitizeAuditMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) =>
      SENSITIVE_KEY_FRAGMENTS.some(fragment => key.toLowerCase().replace(/[^a-z0-9]/g, "").includes(fragment)) ? [key, "[redacted]"] : [key, value]
    )
  );
}

export function createAuditEvent(
  input: Omit<AuditEvent, "id" | "createdAt">,
  now = new Date().toISOString()
): AuditEvent {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    metadata: sanitizeAuditMetadata(input.metadata)
  };
}