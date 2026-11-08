# Subdomain change seen by two api processes

Two api processes of the same image (ports 23100 and 23101). Both answer for the old host, so each has it in memory; one process changes the subdomain; the script asserts that both stop resolving the old host and resolve the new one within 1000 ms, measured from the mutation's response.

### Before: old host on http://127.0.0.1:23100

```http
GET http://127.0.0.1:23100/store/resolve?host=demo2.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A2_ID>",
  "name": "Demo Store 2",
  "language": "en",
  "logo": null,
  "primaryHost": "demo2.localhost",
  "status": "active"
}
```

### Before: old host on http://127.0.0.1:23101

```http
GET http://127.0.0.1:23101/store/resolve?host=demo2.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A2_ID>",
  "name": "Demo Store 2",
  "language": "en",
  "logo": null,
  "primaryHost": "demo2.localhost",
  "status": "active"
}
```

### changeStoreSubdomain on the first process

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id subdomain status } }",
  "variables": {
    "id": "<STORE_A2_ID>",
    "subdomain": "demo2-new"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "changeStoreSubdomain": {
      "id": "<STORE_A2_ID>",
      "subdomain": "demo2-new",
      "status": "active"
    }
  }
}
```

### After: old host on http://127.0.0.1:23100

```http
GET http://127.0.0.1:23100/store/resolve?host=demo2.localhost

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-08T23:33:13.228Z",
  "path": "/store/resolve?host=demo2.localhost"
}
```

### After: new host on http://127.0.0.1:23100

```http
GET http://127.0.0.1:23100/store/resolve?host=demo2-new.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A2_ID>",
  "name": "Demo Store 2",
  "language": "en",
  "logo": null,
  "primaryHost": "demo2-new.localhost",
  "status": "active"
}
```

### After: old host on http://127.0.0.1:23101

```http
GET http://127.0.0.1:23101/store/resolve?host=demo2.localhost

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Not Found",
  "timestamp": "2026-11-08T23:33:13.381Z",
  "path": "/store/resolve?host=demo2.localhost"
}
```

### After: new host on http://127.0.0.1:23101

```http
GET http://127.0.0.1:23101/store/resolve?host=demo2-new.localhost

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_A_ID>",
  "storeId": "<STORE_A2_ID>",
  "name": "Demo Store 2",
  "language": "en",
  "logo": null,
  "primaryHost": "demo2-new.localhost",
  "status": "active"
}
```

