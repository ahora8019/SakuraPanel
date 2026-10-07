import type { ID, ISODateString } from "../types/common";

export type ConfigStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface ConfigIdentity {
  userId: ID;
  deviceId?: ID;
}

export interface GeneratedConfig {
  id: ID;
  userId: ID;
  deviceId?: ID;
  endpointId: ID;
  templateId: ID;
  templateVersion: number;
  payload: Record<string, unknown>;
  status: ConfigStatus;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
}