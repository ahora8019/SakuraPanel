import type { AuthPrincipal } from "./auth";
import type { SessionRepository } from "../repositories/session-repository";
import type { UserRepository, UserRecord } from "../repositories/user-repository";

export interface SessionValidationResult {
  principal: AuthPrincipal;
  user: UserRecord;
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository
  ) {}

  async validate(
    principal: AuthPrincipal,
    now = new Date()
  ): Promise<SessionValidationResult | null> {
    const nowIso = now.toISOString();
    const session = await this.sessions.findActiveById(principal.sessionId, nowIso);
    if (!session || session.user_id !== principal.userId) return null;

    const user = await this.users.findById(principal.userId);
    if (!user || user.status !== "ACTIVE") return null;

    if (user.role !== principal.role) return null;
    if (session.token_version !== principal.tokenVersion) return null;
    if (user.security_version !== principal.securityVersion) return null;

    await this.sessions.touch(principal.sessionId, nowIso);

    return { principal, user };
  }
}
