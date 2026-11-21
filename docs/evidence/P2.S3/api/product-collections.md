# A product's collections

The product editor's collections block (D2324a): the manual collections a product was put in by hand, and the automatic ones its facts match (read-only). Setting a product's collections replaces its manual links only (D2309).

### storeProductCollections of p1: manual and added by rule

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($productId: ID!) { storeProductCollections(productId: $productId) { manual { id title } automatic { id title } } }",
  "variables": {
    "productId": "11"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"f1-7km24k25YOX2uvV+mFntUnYhLn0"

{
  "data": {
    "storeProductCollections": {
      "manual": [
        {
          "id": "2",
          "title": "تخفيضات الصيف"
        }
      ],
      "automatic": [
        {
          "id": "6",
          "title": "أحذية ترويجية حمراء"
        },
        {
          "id": "7",
          "title": "أي شرط"
        },
        {
          "id": "9",
          "title": "كل الأحمر"
        }
      ]
    }
  }
}
```

### GET /catalog/collections/of-product/:productId

```http
GET http://127.0.0.1:23100/catalog/collections/of-product/11
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"cb-D7dPICMzJPZBvzHLiwtJXKXxOxU"

{
  "manual": [
    {
      "id": "2",
      "title": "تخفيضات الصيف"
    }
  ],
  "automatic": [
    {
      "id": "6",
      "title": "أحذية ترويجية حمراء"
    },
    {
      "id": "7",
      "title": "أي شرط"
    },
    {
      "id": "9",
      "title": "كل الأحمر"
    }
  ]
}
```

### setStoreProductCollections: p4 into the summer collection

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($productId: ID!, $collectionIds: [ID!]!) { setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id title } automatic { id title } } }",
  "variables": {
    "productId": "14",
    "collectionIds": [
      "2"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"b9-/oNesvRXVrls1GWjzVlyivSoUxc"

{
  "data": {
    "setStoreProductCollections": {
      "manual": [
        {
          "id": "2",
          "title": "تخفيضات الصيف"
        }
      ],
      "automatic": [
        {
          "id": "7",
          "title": "أي شرط"
        },
        {
          "id": "10",
          "title": "بلا أحمر"
        }
      ]
    }
  }
}
```

### PUT /catalog/collections/of-product/:productId with none: the manual link goes, the rule's stay

```http
PUT http://127.0.0.1:23100/catalog/collections/of-product/14
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "collectionIds": []
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"62-HudFdPVwvI0Xx506qy09GqHYCDw"

{
  "manual": [],
  "automatic": [
    {
      "id": "7",
      "title": "أي شرط"
    },
    {
      "id": "10",
      "title": "بلا أحمر"
    }
  ]
}
```

### setStoreProductCollections with business B's collection: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($productId: ID!, $collectionIds: [ID!]!) { setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id title } automatic { id title } } }",
  "variables": {
    "productId": "14",
    "collectionIds": [
      "4"
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"b6-FLptCiedxazwCCHcb0pOIctXMKU"

{
  "errors": [
    {
      "message": "Collection not found.",
      "locations": [
        {
          "line": 1,
          "column": 54
        }
      ],
      "path": [
        "setStoreProductCollections"
      ],
      "extensions": {
        "code": "collections.not-found"
      }
    }
  ],
  "data": null
}
```

### catalogCollectionOptions: the collections catalog's product list filters by

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { catalogCollectionOptions { id title } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"128-vyugJ66Cu/Eb71yw6hyzy+tojZs"

{
  "data": {
    "catalogCollectionOptions": [
      {
        "id": "2",
        "title": "تخفيضات الصيف"
      },
      {
        "id": "6",
        "title": "أحذية ترويجية حمراء"
      },
      {
        "id": "7",
        "title": "أي شرط"
      },
      {
        "id": "9",
        "title": "كل الأحمر"
      },
      {
        "id": "8",
        "title": "بدون ترويج"
      },
      {
        "id": "10",
        "title": "بلا أحمر"
      }
    ]
  }
}
```

