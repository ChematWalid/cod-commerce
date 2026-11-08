# Store resolution (public REST)

What the storefront asks on each request. Only public fields leave; an unknown host is a <ADMIN_C_ID>0<ADMIN_C_ID>, never a 500.

### resolve demo.localhost

```http
GET http://127.0.0.1:23100/store/resolve?host=demo.localhost

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

HTTP/1.1 <ADMIN_C_ID>0<ADMIN_C_ID> Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": <ADMIN_C_ID>0<ADMIN_C_ID>,
  "message": "Not Found",
  "timestamp": "2026-11-08T23:0<ADMIN_C_ID>:13.929Z",
  "path": "/store/resolve?host=nope.localhost"
}
```

### by-id of the second store

```http
GET http://127.0.0.1:23100/store/by-id/<STORE_B_ID>

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

HTTP/1.1 <ADMIN_C_ID>0<ADMIN_C_ID> Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": <ADMIN_C_ID>0<ADMIN_C_ID>,
  "message": "Not Found",
  "timestamp": "2026-11-08T23:0<ADMIN_C_ID>:1<ADMIN_C_ID>.059Z",
  "path": "/store/by-id/1"
}
```

