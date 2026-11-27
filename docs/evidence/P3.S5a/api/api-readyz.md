# Storefront node-level readiness: GET /api/readyz (live, 2026-11-27T14:02Z)

## The node-local api is ready

```http
GET /api/readyz HTTP/1.1
Host: 127.0.0.1
```

Status: 200

```http
cache-control: no-store
content-type: application/json
```

```json
{
  "status": "ready",
  "checks": {
    "storefront": {
      "ok": true,
      "durationMs": 0
    },
    "api": {
      "ok": true,
      "durationMs": 2
    }
  }
}
```

## The node-local api is stopped: 503, without its error text

```http
GET /api/readyz HTTP/1.1
Host: 127.0.0.1
```

Status: 503

```http
cache-control: no-store
content-type: application/json
```

```json
{
  "status": "not_ready",
  "checks": {
    "storefront": {
      "ok": true,
      "durationMs": 0
    },
    "api": {
      "ok": false,
      "durationMs": 51,
      "reason": "api_unreachable"
    }
  }
}
```

