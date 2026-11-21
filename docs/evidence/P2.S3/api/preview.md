# Live preview of an unsaved rule

The editor previews a rule while it is edited (AC4, D2331): a count and a page of matches, nothing saved. Each preview reads the whole store, so an administrator gets a per-minute budget (D2338).

### previewStoreCollectionMatches: the All rule of AC1

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: StoreCollectionPreviewInput!) { previewStoreCollectionMatches(input: $input) { totalItems items { productId title price } } }",
  "variables": {
    "input": {
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "values": [
              "<TAG_PROMO>"
            ]
          },
          {
            "field": "price",
            "operator": "between",
            "min": 2000,
            "max": 5000
          },
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_any_of",
            "values": [
              "أحمر"
            ]
          }
        ]
      },
      "take": 10
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"89-8o6BLjfByOxutxKNUwoWHGhtdc4"

{
  "data": {
    "previewStoreCollectionMatches": {
      "totalItems": 1,
      "items": [
        {
          "productId": "11",
          "title": "حذاء جري أحمر",
          "price": 2500
        }
      ]
    }
  }
}
```

### The same conditions with Any, first page of two

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: StoreCollectionPreviewInput!) { previewStoreCollectionMatches(input: $input) { totalItems items { productId title price } } }",
  "variables": {
    "input": {
      "rule": {
        "version": 1,
        "match": "any",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "values": [
              "<TAG_PROMO>"
            ]
          },
          {
            "field": "price",
            "operator": "between",
            "min": 2000,
            "max": 5000
          },
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_any_of",
            "values": [
              "أحمر"
            ]
          }
        ]
      },
      "skip": 0,
      "take": 2
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"c7-w+Ub+JXXm09MGPX0FBZ/ZNAvp1s"

{
  "data": {
    "previewStoreCollectionMatches": {
      "totalItems": 5,
      "items": [
        {
          "productId": "14",
          "title": "حقيبة جري",
          "price": 6000
        },
        {
          "productId": "13",
          "title": "قميص قطني أحمر",
          "price": 2500
        }
      ]
    }
  }
}
```

### Second page of two

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: StoreCollectionPreviewInput!) { previewStoreCollectionMatches(input: $input) { totalItems items { productId title price } } }",
  "variables": {
    "input": {
      "rule": {
        "version": 1,
        "match": "any",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "values": [
              "<TAG_PROMO>"
            ]
          },
          {
            "field": "price",
            "operator": "between",
            "min": 2000,
            "max": 5000
          },
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_any_of",
            "values": [
              "أحمر"
            ]
          }
        ]
      },
      "skip": 2,
      "take": 2
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"cc-aidTalDO0gtyLN+HsSvE1gDPcJ4"

{
  "data": {
    "previewStoreCollectionMatches": {
      "totalItems": 5,
      "items": [
        {
          "productId": "12",
          "title": "حذاء جري أزرق",
          "price": 2800
        },
        {
          "productId": "11",
          "title": "حذاء جري أحمر",
          "price": 2500
        }
      ]
    }
  }
}
```

### POST /catalog/collections/preview

```http
POST http://127.0.0.1:23100/catalog/collections/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "rule": {
    "version": 1,
    "match": "any",
    "conditions": [
      {
        "field": "tag",
        "operator": "is_any_of",
        "values": [
          "<TAG_PROMO>"
        ]
      },
      {
        "field": "price",
        "operator": "between",
        "min": 2000,
        "max": 5000
      },
      {
        "field": "option",
        "option": "اللون",
        "operator": "is_any_of",
        "values": [
          "أحمر"
        ]
      }
    ]
  },
  "take": 5
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"1c3-xD9IWH7gG+fLlYjbLz0JuNGe5C4"

{
  "totalItems": 5,
  "items": [
    {
      "productId": "14",
      "title": "حقيبة جري",
      "status": "active",
      "price": 6000
    },
    {
      "productId": "13",
      "title": "قميص قطني أحمر",
      "status": "active",
      "price": 2500
    },
    {
      "productId": "12",
      "title": "حذاء جري أزرق",
      "status": "active",
      "price": 2800
    },
    {
      "productId": "11",
      "title": "حذاء جري أحمر",
      "status": "active",
      "price": 2500
    },
    {
      "productId": "1",
      "title": "قميص قطني تجريبي",
      "status": "active",
      "price": 2500
    }
  ]
}
```

### GET /catalog/collections after the previews: still 8 collections, nothing saved

```http
GET http://127.0.0.1:23100/catalog/collections?take=1
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"19f-W94emUoIRW61arh8hp4HY4FYu5w"

{
  "items": [
    {
      "title": "تخفيضات الصيف",
      "slug": "تخفيضات-الصيف",
      "description": "مختارات الصيف بأسعار مخفضة",
      "featuredAsset": {
        "id": "1",
        "preview": "http://127.0.0.1:23100/assets/b/249806488732704768/s/<STORE_DEMO>/preview/7a/7a0f8f799fa729474e6c2776e16bc870__preview.png"
      },
      "id": "2",
      "mode": "manual",
      "rule": null,
      "visible": true,
      "position": 0,
      "productCount": 3
    }
  ],
  "totalItems": 8
}
```

### previewStoreCollectionMatches past the budget (preview 29 in a minute): refused with retryAfterSeconds

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: StoreCollectionPreviewInput!) { previewStoreCollectionMatches(input: $input) { totalItems items { productId title price } } }",
  "variables": {
    "input": {
      "rule": {
        "version": 1,
        "match": "all",
        "conditions": [
          {
            "field": "tag",
            "operator": "is_any_of",
            "values": [
              "<TAG_PROMO>"
            ]
          },
          {
            "field": "price",
            "operator": "between",
            "min": 2000,
            "max": 5000
          },
          {
            "field": "option",
            "option": "اللون",
            "operator": "is_any_of",
            "values": [
              "أحمر"
            ]
          }
        ]
      },
      "take": 1
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"e2-yrYws8e92wL+ekMU8rGNL8n7PRo"

{
  "errors": [
    {
      "message": "Too many requests. Try again shortly.",
      "locations": [
        {
          "line": 1,
          "column": 48
        }
      ],
      "path": [
        "previewStoreCollectionMatches"
      ],
      "extensions": {
        "code": "collections.rate-limited",
        "retryAfterSeconds": 2
      }
    }
  ],
  "data": null
}
```

### POST /catalog/collections/preview past the budget: 429 with Retry-After

```http
POST http://127.0.0.1:23100/catalog/collections/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "rule": {
    "version": 1,
    "match": "all",
    "conditions": [
      {
        "field": "tag",
        "operator": "is_any_of",
        "values": [
          "<TAG_PROMO>"
        ]
      },
      {
        "field": "price",
        "operator": "between",
        "min": 2000,
        "max": 5000
      },
      {
        "field": "option",
        "option": "اللون",
        "operator": "is_any_of",
        "values": [
          "أحمر"
        ]
      }
    ]
  },
  "take": 1
}

HTTP/1.1 429 Too Many Requests
retry-after: 2
content-type: application/json; charset=utf-8
etag: W/"8c-wE10Xdn7mF4ke/NaTMsRQqY7Rwk"

{
  "statusCode": 429,
  "code": "collections.rate-limited",
  "message": "Too many requests. Try again shortly.",
  "path": "/catalog/collections/preview"
}
```

