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

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "apiKey",
  "privateKey"
]);

export function sanitizeAuditMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) =>
      SENSITIVE_KEYS.has(key) ? [key, "[redacted]"] : [key, value]
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