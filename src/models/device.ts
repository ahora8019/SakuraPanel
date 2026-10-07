import type { ID, ISODateString } from "../types/common";

export type DeviceStatus = "ACTIVE" | "DISABLED";

export interface Device {
  id: ID;
  userId: ID;
  name: string;
  deviceType?: string;
  status: DeviceStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
