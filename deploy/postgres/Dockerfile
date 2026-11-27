# The data tier's Postgres with pgBackRest for WAL archiving and point-in-time restore (P3.S5a Task 7, ADR 0011).
# Same base image as docker-compose.yml's postgres service (pgbackrest.test.ts keeps them equal); the package comes
# from the PGDG apt repository the base image already trusts. Bump the version with the base image:
#   docker run --rm <base> sh -c 'apt-get update -qq && apt-cache policy pgbackrest'
FROM postgres:17.11@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f

RUN apt-get update \
  && apt-get install -y --no-install-recommends pgbackrest=2.60.1-1.pgdg13+1 \
  && rm -rf /var/lib/apt/lists/* \
  && install -d -o postgres -g postgres -m 0750 /var/lib/pgbackrest /var/log/pgbackrest /etc/pgbackrest
