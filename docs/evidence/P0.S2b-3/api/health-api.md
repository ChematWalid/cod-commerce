# API health

Liveness and readiness of the api service (container port 3000, published on `23100`). Readiness turns 503 while Valkey is stopped and recovers without a restart.

### Healthy: GET /livez

```http
GET http://127.0.0.1:23100/livez

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ready",
  "checks": {
    "eventLoop": {
      "ok": true
    }
  }
}
```

### Healthy: GET /readyz

```http
GET http://127.0.0.1:23100/readyz

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ready",
  "checks": {
    "postgres": {
      "ok": true
    },
    "redis": {
      "ok": true
    },
    "migrations": {
      "ok": true
    }
  }
}
```

### Valkey stopped: GET /livez

```http
GET http://127.0.0.1:23100/livez

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ready",
  "checks": {
    "eventLoop": {
      "ok": true
    }
  }
}
```

### Valkey stopped: GET /readyz

```http
GET http://127.0.0.1:23100/readyz

HTTP/1.1 503 Service Unavailable
content-type: application/json

{
  "status": "not_ready",
  "checks": {
    "postgres": {
      "ok": true
    },
    "redis": {
      "ok": false,
      "error": "Stream isn't writeable and enableOfflineQueue options is false"
    },
    "migrations": {
      "ok": true
    }
  }
}
```

### Valkey started again: GET /livez

```http
GET http://127.0.0.1:23100/livez

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ready",
  "checks": {
    "eventLoop": {
      "ok": true
    }
  }
}
```

### Valkey started again: GET /readyz

```http
GET http://127.0.0.1:23100/readyz

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ready",
  "checks": {
    "postgres": {
      "ok": true
    },
    "redis": {
      "ok": true
    },
    "migrations": {
      "ok": true
    }
  }
}
```

