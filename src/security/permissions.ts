import type { Role } from "./roles";

export const PERMISSIONS = [
  "device:read",
  "device:write",
  "config:read",
  "config:write",
  "subscription:read",
  "subscription:write",
  "user:read",
  "user:write",
  "audit:read",
  "security:manage"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: [
    "device:read",
    "device:write",
    "config:read",
    "config:write",
    "subscription:read",
    "subscription:write",
    "user:read",
    "audit:read"
  ],
  MEMBER: [
    "device:read",
    "device:write",
    "config:read",
    "subscription:read"
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
