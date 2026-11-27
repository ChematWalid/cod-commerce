# Backups: pgBackRest, nightly logical dump, Garage lifecycle

P3.S5a Task 7 (ADR 0011, ADR 0012, D3507). Everything here runs locally without an account; the off-site
repository, the dump bucket and the per-role Garage keys are P3.S5b steps.

| Piece | File | Runs |
|---|---|---|
| Postgres 17 with pgBackRest (pinned package) | `deploy/postgres/Dockerfile` | data tier, restore test |
| WAL archiving switch | `docker-compose.yml` (`postgres_start_sh`, `PGBACKREST_ENABLED`, off by default) | every compose stack |
| Archiving overlay: image, local posix repo on the `pgbackrestrepo` volume | `deploy/postgres/compose.yml` | data tier, restore test |
| Node config: repo1 = S3 on the second provider (encrypted), repo2 = local posix | `pgbackrest.conf.example` | P3.S5b (Ansible) |
| Point-in-time restore test | `scripts/ops/restore-test.sh` | monthly; evidence `docs/evidence/P3.S5a/restore-test.md` |
| Nightly encrypted logical dump to the second provider | `scripts/ops/nightly-dump.sh` | cron on the node (P3.S5b); not run yet |
| Private-bucket lifecycle (expiry, aborted multipart) | `scripts/ops/garage-lifecycle.sh` | once per bucket; check `scripts/ops/garage-lifecycle-check.sh` |

## Turning archiving on (data tier)

```sh
docker compose -f docker-compose.yml -f deploy/postgres/compose.yml up -d --build postgres
docker compose -f docker-compose.yml -f deploy/postgres/compose.yml exec -u postgres postgres \
  pgbackrest --stanza=cod stanza-create
docker compose -f docker-compose.yml -f deploy/postgres/compose.yml exec -u postgres postgres \
  pgbackrest --stanza=cod check
```

`PGBACKREST_ENABLED=true` with the plain image refuses to start (no `pgbackrest` binary), so WAL never piles up
behind an archive command that cannot run. Until `stanza-create` has run, `archive-push` fails and Postgres keeps the
WAL and retries; run it right after the first start.

On a deployed node, P3.S5b replaces the overlay's inline config with `pgbackrest.conf.example` filled in, and puts
`PGBACKREST_REPO1_S3_KEY`, `PGBACKREST_REPO1_S3_KEY_SECRET` and `PGBACKREST_REPO1_CIPHER_PASS` in the data tier's
`.env` from Ansible Vault. None of them is ever in a file in this repo. Backups never go to R2 (ADR 0012).

## Restore test

```sh
flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/restore-test.sh
```

It needs the role image (`cod-platform:image-check` from `scripts/ops/image-check.sh`, or `RESTORE_APP_IMAGE`). It
backs up, writes marker rows around a time T, then restores twice into fresh data volumes: to T (rows after T
absent) and to the latest WAL (all rows present). Each time the api answers `/readyz` against the restored database.
The real-backup drill restores from the off-site repository on an Algerian host, never on a GitHub runner (D3507).

## Nightly logical dump

`nightly-dump.sh` pipes `pg_dump --format=custom` through `gpg --encrypt` to a recipient whose public key the operator
imported once; the private key stays off the node. The script never makes a key. It needs `DUMP_GPG_RECIPIENT`,
`DUMP_S3_ENDPOINT`, `DUMP_S3_BUCKET`, `DUMP_S3_REGION`, `DUMP_S3_ACCESS_KEY` and `DUMP_S3_SECRET_KEY`, refuses an R2
endpoint, and sends the credentials to curl on stdin. Retention is the dump bucket's own rule at the second provider.

## Garage lifecycle

`garage-lifecycle.sh` stores three rules on the private bucket: `uploads/` expires after 7 days, `exports/` after
30 days, and multipart uploads left incomplete are aborted after 1 day (D3520). It only sets rules; the per-bucket,
per-role keys (`garage key create`, `garage bucket allow`) are a P3.S5b manual step on the node.
