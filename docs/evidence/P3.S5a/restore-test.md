# Point-in-time restore test (scripts/ops/restore-test.sh, 2026-11-27T18:29Z, commit 1099b109)

Synthetic data on the compose project `cod-restoretest`; pgBackRest posix repository on a named volume.

| Step | Result |
|---|---|
| api `GET /readyz` on the source database | 200 `{"status":"ready","checks":{"postgres":{"ok":true,"durationMs":8},"redis":{"ok":true,"durationMs":3},"migrations":{"ok":true,"durationMs":34}}}` |
| stanza-create, check, full backup | 201 s |
| T (database clock between the batches) | `2026-11-27 18:35:19.670021+00` |
| restore to 2026-11-27 18:35:19.670021+00 (fresh data volume), recovery and promotion | 174 s |
| markers after the point-in-time restore (before/after) | 50/0 (wanted 50/0) |
| api `GET /readyz` on the point-in-time restore | 200 `{"status":"ready","checks":{"postgres":{"ok":true,"durationMs":6},"redis":{"ok":true,"durationMs":4},"migrations":{"ok":true,"durationMs":26}}}` |
| restore to latest (fresh data volume), recovery and promotion | 170 s |
| markers after the latest restore (before/after) | 50/30 (wanted 50/30) |
| api `GET /readyz` on the latest restore | 200 `{"status":"ready","checks":{"postgres":{"ok":true,"durationMs":4},"redis":{"ok":true,"durationMs":2},"migrations":{"ok":true,"durationMs":18}}}` |

```text
stanza: cod
    status: ok
    cipher: none

    db (current)
        wal archive min/max (17): 000000010000000000000001/000000010000000000000007

        full backup: 20261127-183159F
            timestamp start/stop: 2026-11-27 18:31:59+00 / 2026-11-27 18:35:14+00
            wal start/stop: 000000010000000000000004 / 000000010000000000000005
            database size: 37.6MB, database backup size: 37.6MB
            repo1: backup set size: 3.9MB, backup size: 3.9MB
```
