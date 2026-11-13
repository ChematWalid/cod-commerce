# Store resolution (public REST)

What the storefront asks on each request. Only public fields leave; an unknown host is a 404, never a 500.

### resolve demo.localhost

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A_ID>",
  "name": "Demo Store",
  "language": "ar",
  "logo": null,
  "primaryHost": "demo.localhost",
  "status": "active"
}
```

### resolve an unusual host form (case and port)

```http
GET http://127.0.0.1:23100/store/resolve?host=DEMO.Localhost:3001
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A_ID>",
  "name": "Demo Store",
  "language": "ar",
  "logo": null,
  "primaryHost": "demo.localhost",
  "status": "active"
}
```

### resolve an unknown host

```http
GET http://127.0.0.1:23100/store/resolve?host=nope.localhost
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-13T11:27:36.455Z",
  "path": "/store/resolve?host=nope.localhost"
}
```

### by-id of the second store

```http
GET http://127.0.0.1:23100/store/by-id/<STORE_B_ID>
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_B_ID>",
  "storeId": "<STORE_B_ID>",
  "name": "Second Store",
  "language": "fr",
  "logo": null,
  "primaryHost": "second.localhost",
  "status": "active"
}
```

### by-id of an unknown store

```http
GET http://127.0.0.1:23100/store/by-id/1
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-13T11:27:45.232Z",
  "path": "/store/by-id/1"
}
```

