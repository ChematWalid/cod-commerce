# Storefront liveness

`GET /livez` on the storefront role (container port 3001, published on `23001`) with a host that belongs to no store: liveness does not depend on the Host header.

### GET /livez with Host: 10.0.0.5:3001

```http
GET http://127.0.0.1:23001/livez
Host: 10.0.0.5:3001

HTTP/1.1 200 OK
content-type: application/json

{
  "status": "ok"
}
```

