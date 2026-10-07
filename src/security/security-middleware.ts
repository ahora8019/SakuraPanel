import { AuthService, type AuthPrincipal } from "./auth";
import type { Permission } from "./permissions";
import { authorize } from "./authorization";
import { D1SessionRepository, type SessionRepository } from "../repositories/session-repository";
import { D1UserRepository } from "../repositories/user-repository";
import { SessionService } from "./session-service";

export interface SecurityContext {
  principal: AuthPrincipal;
}

export async function authenticateRequest(
  request: Request,
  auth: AuthService,
  db?: D1Database,
  sessionRepository?: SessionRepository
): Promise<SecurityContext | null> {
  const token = AuthService.extractBearer(request);
  if (!token) return null;

  const principal = await auth.verifyToken(token);
  if (!principal) return null;

  if (!db) return null;

  const sessions = sessionRepository ?? new D1SessionRepository(db);
  const users = new D1UserRepository(db);
  const sessionService = new SessionService(sessions, users);
  const validated = await sessionService.validate(principal);

  return validated ? { principal: validated.principal } : null;
}

export function requirePermission(
  context: SecurityContext | null,
  permission: Permission
): SecurityContext {
  if (!context || !authorize(context.principal, permission)) {
    throw new Error("forbidden");
  }

  return context;
}
