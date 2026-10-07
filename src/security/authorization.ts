import type { Permission } from "./permissions";
import { hasPermission } from "./permissions";
import type { AuthPrincipal } from "./auth";

export function authorize(
  principal: AuthPrincipal | null,
  permission: Permission
): boolean {
  return principal !== null && hasPermission(principal.role, permission);
}

export function requireAuthorization(
  principal: AuthPrincipal | null,
  permission: Permission
): void {
  if (!authorize(principal, permission)) {
    throw new Error("forbidden");
  }
}