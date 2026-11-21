# Business A against business B's collections

A foreign or malformed id answers exactly like an unknown one; another business's channel token is refused outright; a merchant holds no grant on Vendure's stock collection API (D2101); store collections live in their store channel only, never the default channel (D2333).

### storeCollection with B's collection id, A's session on A's store: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { storeCollection(id: $id) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "4"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollection": null
  }
}
```

### GET /catalog/collections/<B's collection>: 404

```http
GET http://127.0.0.1:23100/catalog/collections/4
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.not-found",
  "message": "Collection not found.",
  "path": "/catalog/collections/4"
}
```

### GET /catalog/collections/abc (malformed): the same 404

```http
GET http://127.0.0.1:23100/catalog/collections/abc
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.not-found",
  "message": "Collection not found.",
  "path": "/catalog/collections/abc"
}
```

### updateStoreCollection of B's collection: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateStoreCollectionInput!) { updateStoreCollection(id: $id, input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "4",
    "input": {
      "title": "x"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Collection not found.",
      "locations": [
        {
          "line": 1,
          "column": 60
        }
      ],
      "path": [
        "updateStoreCollection"
      ],
      "extensions": {
        "code": "collections.not-found"
      }
    }
  ],
  "data": null
}
```

### setStoreCollectionProducts on B's collection: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id mode productCount } }",
  "variables": {
    "id": "4",
    "productIds": [
      "11"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Collection not found.",
      "locations": [
        {
          "line": 1,
          "column": 44
        }
      ],
      "path": [
        "setStoreCollectionProducts"
      ],
      "extensions": {
        "code": "collections.not-found"
      }
    }
  ],
  "data": null
}
```

### DELETE /catalog/collections/<B's collection>: 404

```http
DELETE http://127.0.0.1:23100/catalog/collections/4
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.not-found",
  "message": "Collection not found.",
  "path": "/catalog/collections/4"
}
```

### GET /catalog/collections/of-product/<B's product>: 404

```http
GET http://127.0.0.1:23100/catalog/collections/of-product/16
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.product-not-found",
  "message": "A product was not found in this store.",
  "path": "/catalog/collections/of-product/16"
}
```

### B reads its collection: unchanged by A's attempts

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { storeCollection(id: $id) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "4"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollection": {
      "id": "4",
      "title": "Collection B",
      "slug": "ev-b-collection",
      "description": null,
      "featuredAsset": null,
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 0,
      "productCount": 0
    }
  }
}
```

### storeCollections, A's session with B's channel token: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: StoreCollectionListInput) { storeCollections(options: $options) { totalItems items { id title slug mode visible position productCount } } }",
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
          "column": 46
        }
      ],
      "path": [
        "storeCollections"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### GET /catalog/collections, A's session with B's channel token: 403

```http
GET http://127.0.0.1:23100/catalog/collections
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-21T03:14:36.412Z",
  "path": "/catalog/collections"
}
```

### Vendure's stock collections query as the merchant: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { collections { totalItems items { id name } } }",
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
        "collections"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### The stock collections query on the default channel (platform account, no channel token): none of the store collections

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { collections { totalItems items { id name } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "collections": {
      "totalItems": 0,
      "items": []
    }
  }
}
```

