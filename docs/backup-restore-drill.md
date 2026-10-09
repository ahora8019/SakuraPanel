# D1 Backup and Restore Drill

## Safety rules

- Never commit SQL exports or backup artifacts to Git.
- Treat exports as sensitive: they can contain usernames, configuration payloads, subscription/session metadata, and audit records.
- Export during a low-traffic window. Cloudflare notes that a D1 export can temporarily make the database unavailable while it runs.
- Never test restore by overwriting production. Restore into a separate, isolated D1 database first.
- A bookmark, export request ID, or HTTP 200 is not a completed backup. Completion requires a downloadable artifact, a checksum, secure retention, and a restore verification record.

## Create and verify an export

Run from a trusted machine with Wrangler authenticated to the intended Cloudflare account:

```sh
umask 077
mkdir -p backups
npx wrangler d1 export sakurapanel --remote --output=backups/sakurapanel-$(date -u +%Y%m%dT%H%M%SZ).sql
```

Immediately verify the command exited successfully and the file is non-empty:

```sh
test -s backups/sakurapanel-*.sql
sha256sum backups/sakurapanel-*.sql
```

Encrypt the export before transferring it to durable storage. Store the checksum separately from the artifact. Do not upload the SQL file to a public artifact, public repository, or chat. Define a retention period and verify access controls on the backup destination.

## Isolated restore drill

1. Create a separate D1 database named `sakurapanel-restore-drill` in the same compatible Cloudflare account/region.
2. Confirm its database ID is not the production database ID.
3. Import the selected export into that isolated database using Wrangler's D1 execute/import workflow supported by the installed Wrangler version. Never substitute the production database name or ID.
4. Run schema and integrity checks against the isolated database. At minimum:
   - list expected tables and compare with `src/core/diagnostics.ts`;
   - run `PRAGMA integrity_check`;
   - run `PRAGMA foreign_key_check`;
   - compare row counts for core tables with the source export's recorded counts;
   - run the application test suite against the restored schema where practical.
5. Record the source export checksum, source database name, restore target ID (not secrets), start/end times, checks performed, and result.
6. Delete the isolated drill database only after the evidence is saved and the result has been reviewed. Never delete the production database.

## Evidence record

Fill this in for each real drill:

- Export completed at (UTC):
- Export file size:
- SHA-256:
- Secure storage location (no public URL):
- Restore target database name:
- Schema check: PASS / FAIL
- Integrity check: PASS / FAIL
- Foreign-key check: PASS / FAIL
- Core row-count comparison: PASS / FAIL
- Application compatibility check: PASS / FAIL / NOT RUN
- Operator and review date:

Until a real export and isolated restore have been completed and this record is filled, backup/restore status remains **NOT RUN**.
