#!/usr/bin/env node

const baseUrl = process.env.SAKURAPANEL_SMOKE_URL?.trim();

if (!baseUrl) {
  console.error("SAKURAPANEL_SMOKE_URL is required for production smoke tests.");
  process.exit(1);
}

const normalized = baseUrl.replace(/\/+$/, "");

if (!/^https:\/\//i.test(normalized)) {
  console.error("SAKURAPANEL_SMOKE_URL must use HTTPS.");
  process.exit(1);
}

async function request(path) {
  const response = await fetch(normalized + path, {
    redirect: "error",
    headers: { "accept": "application/json" }
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(path + ": response was not valid JSON");
  }

  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await request("/health");
assert(health.response.status === 200, "/health must return 200");
assert(health.body?.ok === true, "/health must return ok=true");
assert(typeof health.body?.requestId === "string" && health.body.requestId.length > 0, "/health must return requestId");
assert(health.response.headers.get("x-request-id") === health.body.requestId, "/health x-request-id must match body requestId");
assert(health.response.headers.get("cache-control") === "no-store", "/health must be no-store");

const ready = await request("/ready");
assert(ready.response.status === 200, "/ready must return 200");
assert(ready.body?.ok === true, "/ready must return ok=true");
assert(ready.body?.checks?.database === "ok", "/ready database check must be ok");
assert(typeof ready.body?.requestId === "string" && ready.body.requestId.length > 0, "/ready must return requestId");
assert(ready.response.headers.get("x-request-id") === ready.body.requestId, "/ready x-request-id must match body requestId");
assert(ready.response.headers.get("cache-control") === "no-store", "/ready must be no-store");

const notFound = await request("/__sakurapanel_smoke_not_found__");
assert(notFound.response.status === 404, "unknown route must return 404");
assert(notFound.body?.error === "not_found", "unknown route must return safe not_found error");

const invalidSubscription = await request(`/s/${"A".repeat(43)}`);
assert(invalidSubscription.response.status === 404, "invalid public subscription token must return 404");
assert(invalidSubscription.body?.error === "subscription_not_found", "invalid public subscription token must not disclose data");

console.log(JSON.stringify({
  ok: true,
  service: "sakurapanel",
  checks: ["health", "readiness", "unknown_route", "invalid_subscription_token"]
}));
