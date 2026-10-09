import { describe, expect, it } from "vitest";
import { UserService } from "../src/core/user-service";
import type { D1UserRepository, UserRecord } from "../src/repositories/user-repository";
import type { Role } from "../src/security/roles";

function makeService(initial: UserRecord[]) {
  const users = [...initial];
  const repo = {
    findById: async (id: string) => users.find(user => user.id === id) ?? null,
    findByUsername: async (username: string) => users.find(user => user.username === username) ?? null,
    list: async () => ({ results: users }),
    countActiveOwners: async () => users.filter(user => user.role === "OWNER" && user.status === "ACTIVE").length,
    create: async (user: UserRecord) => { users.push(user); },
    updateStatus: async (id: string, status: UserRecord["status"], updatedAt: string) => {
      const user = users.find(item => item.id === id);
      if (user) {
        user.status = status;
        user.security_version += 1;
        user.updated_at = updatedAt;
      }
    }
  };
  return { service: new UserService(repo as unknown as D1UserRepository), users };
}

function user(id: string, role: Role, status: UserRecord["status"] = "ACTIVE"): UserRecord {
  return {
    id, username: id, role, status, security_version: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  };
}

describe("user role and owner safeguards", () => {
  it("prevents ADMIN from creating an OWNER or ADMIN", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER"), user("admin-1", "ADMIN")]);
    await expect(service.create({ username: "newowner", role: "OWNER", actorRole: "ADMIN", now: "2026-01-02T00:00:00.000Z" }))
      .rejects.toThrow("forbidden");
    await expect(service.create({ username: "newadmin", role: "ADMIN", actorRole: "ADMIN", now: "2026-01-02T00:00:00.000Z" }))
      .rejects.toThrow("forbidden");
    expect(users.some(item => item.username === "newowner" || item.username === "newadmin")).toBe(false);
  });

  it("prevents MEMBER from creating users even when the service is called directly", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER"), user("member-1", "MEMBER")]);
    await expect(service.create({ username: "othermember", role: "MEMBER", actorRole: "MEMBER", now: "2026-01-02T00:00:00.000Z" }))
      .rejects.toThrow("forbidden");
    expect(users.some(item => item.username === "othermember")).toBe(false);
  });

  it("allows OWNER to create an additional OWNER", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER")]);
    const created = await service.create({ username: "owner-two", role: "OWNER", actorRole: "OWNER", now: "2026-01-02T00:00:00.000Z" });
    expect(created.role).toBe("OWNER");
    expect(users.filter(item => item.role === "OWNER")).toHaveLength(2);
  });

  it("prevents disabling the only active OWNER", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER")]);
    await expect(service.updateStatus("owner-1", "DISABLED", "OWNER", "2026-01-02T00:00:00.000Z"))
      .rejects.toThrow("last_active_owner");
    expect(users[0].status).toBe("ACTIVE");
  });

  it("allows an OWNER to suspend one owner when another active owner remains", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER"), user("owner-2", "OWNER")]);
    await service.updateStatus("owner-1", "SUSPENDED", "OWNER", "2026-01-02T00:00:00.000Z");
    expect(users.find(item => item.id === "owner-1")?.status).toBe("SUSPENDED");
    expect(users.filter(item => item.role === "OWNER" && item.status === "ACTIVE")).toHaveLength(1);
  });

  it("prevents ADMIN from changing an OWNER status", async () => {
    const { service, users } = makeService([user("owner-1", "OWNER"), user("admin-1", "ADMIN")]);
    await expect(service.updateStatus("owner-1", "DISABLED", "ADMIN", "2026-01-02T00:00:00.000Z"))
      .rejects.toThrow("forbidden");
    expect(users[0].status).toBe("ACTIVE");
  });
});
