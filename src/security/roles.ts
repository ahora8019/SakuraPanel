export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleRank(role: Role): number {
  return role === "OWNER" ? 3 : role === "ADMIN" ? 2 : 1;
}