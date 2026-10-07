export interface LockStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class EmergencyLock {
  constructor(
    private readonly store: LockStore,
    private readonly key = "security:emergency-lock"
  ) {}

  async isLocked(): Promise<boolean> {
    return (await this.store.get(this.key)) === "1";
  }

  async lock(ttlSeconds?: number): Promise<void> {
    await this.store.put(
      this.key,
      "1",
      ttlSeconds ? { expirationTtl: ttlSeconds } : undefined
    );
  }

  async unlock(): Promise<void> {
    await this.store.delete(this.key);
  }

  async assertUnlocked(): Promise<void> {
    if (await this.isLocked()) {
      throw new Error("emergency_lock_active");
    }
  }
}