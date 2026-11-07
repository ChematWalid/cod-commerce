# migrate

The one-shot `migrate` service runs migrations and the seed before api and worker start. The `migrate.done` line of its container log (the rest is migration SQL and timestamped framework output) and its exit code, taken with `docker inspect`.

### First start (empty database)

```text
{
  "event": "migrate.done",
  "migrationsRun": [
    "Init1794078924166"
  ],
  "seed": {
    "changes": [
      "country:DZ",
      "zone:Algeria",
      "tax-category:Zero rate",
      "tax-rate:Algeria zero rate",
      "channel:__default_channel__",
      "global-settings:availableLanguages"
    ]
  }
}
```

Container exit code (`docker inspect -f {{.State.ExitCode}}`): `0`

### Second start (`docker compose up -d` again)

Nothing left to do: `migrationsRun` and `seed.changes` are empty.

```text
{
  "event": "migrate.done",
  "migrationsRun": [],
  "seed": {
    "changes": []
  }
}
```

Container exit code: `0`

