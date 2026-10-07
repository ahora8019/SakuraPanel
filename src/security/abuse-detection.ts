export type AbuseSignal =
  | "RATE_LIMIT"
  | "AUTH_FAILURE"
  | "INVALID_INPUT"
  | "TOKEN_REUSE"
  | "SUSPICIOUS_VOLUME";

export interface AbuseEvent {
  key: string;
  signal: AbuseSignal;
  at: number;
  weight?: number;
}

export interface AbuseDecision {
  blocked: boolean;
  score: number;
}

export class AbuseDetector {
  private readonly scores = new Map<string, { score: number; expiresAt: number }>();

  constructor(
    private readonly threshold = 10,
    private readonly decayMs = 15 * 60 * 1000
  ) {}

  observe(event: AbuseEvent): AbuseDecision {
    const current = this.scores.get(event.key);
    const now = event.at;

    if (!current || current.expiresAt <= now) {
      const score = event.weight ?? 1;
      this.scores.set(event.key, { score, expiresAt: now + this.decayMs });
      return { blocked: score >= this.threshold, score };
    }

    current.score += event.weight ?? 1;
    return {
      blocked: current.score >= this.threshold,
      score: current.score
    };
  }
}