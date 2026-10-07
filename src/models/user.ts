import type { ID, ISODateString } from "../types/common";
import type { Role } from "../security/roles";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface User {
  id: ID;
  username: string;
  role: Role;
  status: UserStatus;
  securityVersion: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
