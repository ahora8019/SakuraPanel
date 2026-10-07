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