# Evidence for P0.S2b-3 (server data layer and image)

Request/response transcripts from a live run of the compose stack (CLAUDE.md §3a.14). Generated on 2026-11-07 by
`scripts/evidence/P0.S2b-3.sh`; nothing here is hand-written. Data is synthetic (placeholders from `.env.example`);
tokens, cookies and the password are redacted by the script, and per-check `durationMs` values are dropped so re-runs regenerate identical files.

| File                                                 | Shows                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`api/migrate.md`](api/migrate.md)                   | The `migrate` container log excerpt and exit code 0 on the first start, then a no-op second start (nothing migrated or seeded) |
| [`api/health-api.md`](api/health-api.md)             | api `/livez` and `/readyz`: healthy (200), Valkey stopped (503, `redis.ok: false`), recovered (200)                       |
| [`api/health-worker.md`](api/health-worker.md)       | The same three states for the worker health server                                                                     |
| [`api/admin-login.md`](api/admin-login.md)           | Superadmin login through `POST /admin-api` with token and cookie values redacted                                       |
| [`api/admin-seeded-data.md`](api/admin-seeded-data.md) | Authenticated query: DZD, prices include tax, Algeria zones, languages ar/fr/en                                       |

## Re-run

```bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-3.sh
```

It uses its own compose project (`cod-evidence`, host ports shifted by 20000), reuses the `${APP_IMAGE:-cod-platform:local}`
image (building it only when absent), and removes the stack and its volumes on exit. It fails if the password, the cookie
secret or a token value appears in any output file.
