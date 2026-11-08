# Storefront readiness

`GET /readyz` is always 200 and carries the Valkey check in the body (the shared cache is an optimisation: with Valkey down the storefront serves uncached). `cache-control: no-store`. Per-check `durationMs` values are dropped by the transcript script so re-runs regenerate identical files.

### Valkey running: GET /readyz

```http
GET http://127.0.0.1:23001/readyz
Host: 10.0.0.5:3001

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{
  "status": "ready",
  "checks": {
    "redis": {
      "ok": true
    }
  }
}
```

### Valkey stopped: GET /readyz (still 200)

```http
GET http://127.0.0.1:23001/readyz
Host: 10.0.0.5:3001

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{
  "status": "ready",
  "checks": {
    "redis": {
      "ok": false,
      "error": "The client is offline"
    }
  }
}
```

### Valkey started again: GET /readyz

```http
GET http://127.0.0.1:23001/readyz
Host: 10.0.0.5:3001

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{
  "status": "ready",
  "checks": {
    "redis": {
      "ok": true
    }
  }
}
```

