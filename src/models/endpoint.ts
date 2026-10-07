import type { ID, ISODateString } from "../types/common";

export type EndpointStatus =
  | "PROVISIONING"
  | "HEALTHY"
  | "DEGRADED"
  | "DOWN"
  | "DISABLED"
  | "MAINTENANCE"
  | "RETIRED";

export interface Endpoint {
  id: ID;
  name: string;
  host: string;
  port: number;
  transport: string;
  tls: boolean;
  region?: string;
  priority: number;
  status: EndpointStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}