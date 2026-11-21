# Store collections

Collections of the active store (D2300, D2314): reads need `catalog.collections.view`, create `.create`, edit `.edit`, delete `.delete`. The REST routes under `/catalog/collections` mirror the GraphQL operations (D2315). Titles are written in the store's language (Arabic here, D2112).

### createStoreCollection: a manual collection with an Arabic title, whose slug follows it

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "تخفيضات الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "visible": true,
      "position": 1,
      "mode": "manual"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStoreCollection": {
      "id": "2",
      "title": "تخفيضات الصيف",
      "slug": "تخفيضات-الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "featuredAsset": null,
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 1,
      "productCount": 0
    }
  }
}
```

### POST /catalog/collections: 201

```http
POST http://127.0.0.1:23100/catalog/collections
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "إكسسوارات",
  "slug": "accessories",
  "visible": true,
  "position": 2,
  "mode": "manual"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "title": "إكسسوارات",
  "slug": "accessories",
  "description": null,
  "featuredAsset": null,
  "id": "3",
  "mode": "manual",
  "rule": null,
  "visible": true,
  "position": 2,
  "productCount": 0
}
```

### storeCollections

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($options: StoreCollectionListInput) { storeCollections(options: $options) { totalItems items { id title slug mode visible position productCount } } }",
  "variables": {
    "options": {
      "take": 20
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollections": {
      "totalItems": 2,
      "items": [
        {
          "id": "2",
          "title": "تخفيضات الصيف",
          "slug": "تخفيضات-الصيف",
          "mode": "manual",
          "visible": true,
          "position": 1,
          "productCount": 0
        },
        {
          "id": "3",
          "title": "إكسسوارات",
          "slug": "accessories",
          "mode": "manual",
          "visible": true,
          "position": 2,
          "productCount": 0
        }
      ]
    }
  }
}
```

### GET /catalog/collections?search=الصيف (URL-encoded)

```http
GET http://127.0.0.1:23100/catalog/collections?search=%D8%A7%D9%84%D8%B5%D9%8A%D9%81
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "title": "تخفيضات الصيف",
      "slug": "تخفيضات-الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "featuredAsset": null,
      "id": "2",
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 1,
      "productCount": 0
    }
  ],
  "totalItems": 1
}
```

### storeCollection

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { storeCollection(id: $id) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "2"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollection": {
      "id": "2",
      "title": "تخفيضات الصيف",
      "slug": "تخفيضات-الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "featuredAsset": null,
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 1,
      "productCount": 0
    }
  }
}
```

### GET /catalog/collections/:id

```http
GET http://127.0.0.1:23100/catalog/collections/3
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "title": "إكسسوارات",
  "slug": "accessories",
  "description": null,
  "featuredAsset": null,
  "id": "3",
  "mode": "manual",
  "rule": null,
  "visible": true,
  "position": 2,
  "productCount": 0
}
```

### updateStoreCollection: an image from the media library and position 0

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!, $input: UpdateStoreCollectionInput!) { updateStoreCollection(id: $id, input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "2",
    "input": {
      "featuredAssetId": "1",
      "position": 0
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateStoreCollection": {
      "id": "2",
      "title": "تخفيضات الصيف",
      "slug": "تخفيضات-الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "featuredAsset": {
        "id": "1"
      },
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 0,
      "productCount": 0
    }
  }
}
```

### PATCH /catalog/collections/:id: hidden

```http
PATCH http://127.0.0.1:23100/catalog/collections/3
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "visible": false
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "title": "إكسسوارات",
  "slug": "accessories",
  "description": null,
  "featuredAsset": null,
  "id": "3",
  "mode": "manual",
  "rule": null,
  "visible": false,
  "position": 2,
  "productCount": 0
}
```

### storeCollectionSlugAvailability: the Arabic slug in its store, taken

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $collectionId: ID) { storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }",
  "variables": {
    "slug": "تخفيضات-الصيف"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionSlugAvailability": {
      "slug": "تخفيضات-الصيف",
      "available": false
    }
  }
}
```

### The collection's own slug while editing it: free

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $collectionId: ID) { storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }",
  "variables": {
    "slug": "تخفيضات-الصيف",
    "collectionId": "2"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionSlugAvailability": {
      "slug": "تخفيضات-الصيف",
      "available": true
    }
  }
}
```

### GET /catalog/collections/slug-availability (the Arabic slug, URL-encoded): taken

```http
GET http://127.0.0.1:23100/catalog/collections/slug-availability?slug=%D8%AA%D8%AE%D9%81%D9%8A%D8%B6%D8%A7%D8%AA-%D8%A7%D9%84%D8%B5%D9%8A%D9%81
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "slug": "تخفيضات-الصيف",
  "available": false
}
```

### The same slug in business B's store: free

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $collectionId: ID) { storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }",
  "variables": {
    "slug": "تخفيضات-الصيف"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionSlugAvailability": {
      "slug": "تخفيضات-الصيف",
      "available": true
    }
  }
}
```

### Business B creates a collection with slug ev-b-collection

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "Collection B",
      "slug": "ev-b-collection",
      "visible": true,
      "position": 0,
      "mode": "manual"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createStoreCollection": {
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

### Business A asks for B's slug: free in A's store (nothing about B leaks)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($slug: String!, $collectionId: ID) { storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }",
  "variables": {
    "slug": "ev-b-collection"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "storeCollectionSlugAvailability": {
      "slug": "ev-b-collection",
      "available": true
    }
  }
}
```

### createStoreCollection with a slug the store already uses: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "input": {
      "title": "تخفيضات أخرى",
      "slug": "تخفيضات-الصيف",
      "visible": true,
      "position": 3,
      "mode": "manual"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This slug is already used by another collection of this store.",
      "locations": [
        {
          "line": 1,
          "column": 50
        }
      ],
      "path": [
        "createStoreCollection"
      ],
      "extensions": {
        "code": "collections.slug-taken"
      }
    }
  ],
  "data": null
}
```

### POST /catalog/collections with the taken slug: 409

```http
POST http://127.0.0.1:23100/catalog/collections
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "تخفيضات أخرى",
  "slug": "تخفيضات-الصيف",
  "visible": true,
  "position": 3,
  "mode": "manual"
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "collections.slug-taken",
  "message": "This slug is already used by another collection of this store.",
  "path": "/catalog/collections"
}
```

### deleteStoreCollection

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: ID!) { deleteStoreCollection(id: $id) }",
  "variables": {
    "id": "5"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteStoreCollection": true
  }
}
```

### storeCollection after the delete: null

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: ID!) { storeCollection(id: $id) { id title slug description featuredAsset { id } mode rule { version match conditions { field operator option values min max value } } visible position productCount } }",
  "variables": {
    "id": "5"
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

### DELETE /catalog/collections/:id

```http
DELETE http://127.0.0.1:23100/catalog/collections/3
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### GET /catalog/collections/:id after the delete: 404

```http
GET http://127.0.0.1:23100/catalog/collections/3
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "collections.not-found",
  "message": "Collection not found.",
  "path": "/catalog/collections/3"
}
```

