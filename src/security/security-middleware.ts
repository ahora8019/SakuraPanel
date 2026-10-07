import { AuthService, type AuthPrincipal } from "./auth";
import type { Permission } from "./permissions";
import { authorize } from "./authorization";

export interface SecurityContext {
  principal: AuthPrincipal;
}

export async function authenticateRequest(
  request: Request,
  auth: AuthService
): Promise<SecurityContext | null> {
  const token = AuthService.extractBearer(request);
  if (!token) return null;

  const principal = await auth.verifyToken(token);
  return principal ? { principal } : null;
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