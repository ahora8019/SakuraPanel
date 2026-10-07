import type { ID, ISODateString } from "../types/common";

export interface ConfigTemplate {
  id: ID;
  name: string;
  protocol: string;
  version: number;
  definition: Record<string, unknown>;
  status: "ACTIVE" | "DISABLED" | "RETIRED";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}