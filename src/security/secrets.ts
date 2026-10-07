export interface SecretProvider {
  get(name: string): string | undefined;
}

export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly env: Record<string, unknown>) {}

  get(name: string): string | undefined {
    const value = this.env[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}

export function requireSecret(provider: SecretProvider, name: string): string {
  const value = provider.get(name);
  if (!value) throw new Error("missing_required_secret");
  return value;
}

export function redactSecret(value: string, visibleChars = 4): string {
  if (!value) return "[empty]";
  if (value.length <= visibleChars) return "[redacted]";
  return value.slice(0, visibleChars) + "…[redacted]";
}