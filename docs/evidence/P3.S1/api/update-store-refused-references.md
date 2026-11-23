# Store links refused (#230, #153)

`updateStore` naming B's group, or any carrier id before P5.S1 (D3109), answers the one pinned code `tenancy.store-reference-not-found` (D3111); the store keeps its default.

### updateStore(defaultDeliveryFeeGroupId: B's group)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId } }",
  "variables": {
    "id": "<STORE_DEMO>",
    "input": {
      "defaultDeliveryFeeGroupId": "<GROUP_B_PLATFORM_DEFAULT>"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"be-so/z/hNWc8f5nsxLgdOYi28PGLw"

{
  "errors": [
    {
      "message": "The linked record does not exist",
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
        "code": "tenancy.store-reference-not-found"
      }
    }
  ],
  "data": null
}
```

### updateStore(defaultCarrierId: any id)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id defaultDeliveryFeeGroupId } }",
  "variables": {
    "id": "<STORE_DEMO>",
    "input": {
      "defaultCarrierId": "1234567890123456789"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"be-so/z/hNWc8f5nsxLgdOYi28PGLw"

{
  "errors": [
    {
      "message": "The linked record does not exist",
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
        "code": "tenancy.store-reference-not-found"
      }
    }
  ],
  "data": null
}
```

### store(id): the default is unchanged

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { store(id: $id) { id defaultDeliveryFeeGroupId } }",
  "variables": {
    "id": "<STORE_DEMO>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"60-RSK5JLFA0VlAoozl5BZEW7I2TKk"

{
  "data": {
    "store": {
      "id": "<STORE_DEMO>",
      "defaultDeliveryFeeGroupId": "<GROUP_EVIDENCE>"
    }
  }
}
```

