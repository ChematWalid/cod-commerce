# Two businesses: cross-tenant

A's owner holds a session of A and B's ids and channel token. Reads are null or FORBIDDEN, writes refused; the account endpoints only ever show the caller.

### A's owner on B's channel: stores FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { stores { id subdomain } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "stores"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### A: store(B's id) is null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { store(id: $id) { id subdomain } }",
  "variables": {
    "id": "<STORE_b>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "store": null
  }
}
```

### A: updateStore on B's store is not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }",
  "variables": {
    "id": "<STORE_b>",
    "input": {
      "description": "x"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The store does not exist",
      "locations": [
        {
          "line": 1,
          "column": 54
        }
      ],
      "path": [
        "updateStore"
      ],
      "extensions": {
        "code": "tenancy.store-not-found"
      }
    }
  ],
  "data": null
}
```

### A's owner uploads a logo on B's channel: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: multipart/form-data
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

(multipart: a 1x1 PNG as variables.file) mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 29
        }
      ],
      "path": [
        "uploadBusinessLogo"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### B: accountProfile shows B alone

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "accountProfile": {
      "firstName": "Api",
      "lastName": "Owner",
      "emailAddress": "api-b-1@evidence.example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": true
    }
  }
}
```

