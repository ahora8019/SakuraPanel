import type { ID, ISODateString } from "../types/common";

export type ConfigReleaseStatus = "DRAFT" | "PUBLISHED" | "ROLLED_BACK";

export interface ConfigRelease {
  id: ID;
  configId: ID;
  version: number;
  status: ConfigReleaseStatus;
  actorId: ID;
  createdAt: ISODateString;
  publishedAt?: ISODateString;
  rolledBackAt?: ISODateString;
}
