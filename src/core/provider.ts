export type ProviderId = string;

export interface ProviderHealth {
  providerId: ProviderId;
  healthy: boolean;
  checkedAt: string;
  message?: string;
}

export interface PlatformProvider {
  readonly id: ProviderId;
  deploy(): Promise<void>;
  update(): Promise<void>;
  disable(): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface ProviderRegistry {
  register(provider: PlatformProvider): void;
  get(id: ProviderId): PlatformProvider | null;
  list(): PlatformProvider[];
}

export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<ProviderId, PlatformProvider>();

  register(provider: PlatformProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error("provider_already_registered");
    }
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): PlatformProvider | null {
    return this.providers.get(id) ?? null;
  }

  list(): PlatformProvider[] {
    return [...this.providers.values()];
  }
}
