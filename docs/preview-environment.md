# Isolated Preview Environment

The repository contains a manual-only workflow at `.github/workflows/preview.yml`. It is intentionally separate from the production workflow and targets only a Worker named `sakurapanel-preview`.

## One-time Cloudflare setup

Create these resources in the intended Cloudflare account before dispatching the workflow:

- D1 database named exactly `sakurapanel-preview`.
- A dedicated KV namespace for preview emergency-lock state.
- A preview Worker URL on the `workers.dev` subdomain.

Do not reuse the production D1 database ID, production KV namespace, or production secrets.

## GitHub Actions configuration

Configure the GitHub `preview` environment with these secrets:

- `CLOUDFLARE_API_TOKEN`: scoped to the required Worker/D1/KV operations.
- `PREVIEW_D1_DATABASE_ID`: ID of the preview D1 database only.
- `PREVIEW_SECURITY_KV_ID`: ID of the preview KV namespace only.
- `PREVIEW_AUTH_SECRET`: independent secret of at least 32 characters.
- `PREVIEW_BOOTSTRAP_SECRET`: independent bootstrap secret, different from `PREVIEW_AUTH_SECRET`.

Configure the Actions variable `PREVIEW_WORKER_URL` to the HTTPS URL of the preview Worker.

The workflow validates that all preview inputs exist before migrations or deployment, generates a temporary Wrangler config with restrictive file permissions, applies migrations only to the named preview database, sets preview-only Worker secrets, deploys the preview Worker, and runs the smoke test. The temporary Wrangler config is not committed.

## Acceptance checks

- Confirm the deployment log identifies `sakurapanel-preview`, never the production Worker.
- Confirm D1 and KV bindings match the preview resource IDs.
- Confirm the preview Worker has independent secret values; never print them.
- Confirm `/health` and `/ready` pass and `/ready` reports both `database: "ok"` and `securityControl: "ok"`.
- Run authenticated owner/RBAC flows against preview.
- Do not mark preview as complete until the workflow has actually run successfully.
