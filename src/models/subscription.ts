import type { ID, ISODateString } from "../types/common";

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface Subscription {
  id: ID;
  userId: ID;
  status: SubscriptionStatus;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SubscriptionVersion {
  id: ID;
  subscriptionId: ID;
  version: number;
  configIds: ID[];
  createdAt: ISODateString;
}