# A member without offers.view

The seed's orders clerk of the Demo business holds `orders.view` only (D2517): every offers endpoint refuses it.

### GET /offers

```http
GET http://127.0.0.1:23100/offers
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8
etag: W/"71-wCylXO/EyFa4UJaPIRHk99jltwY"

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-21T06:29:43.844Z",
  "path": "/offers"
}
```

### POST /offers/preview

```http
POST http://127.0.0.1:23100/offers/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "offer": {
    "kind": "quantity",
    "title": "معاينة",
    "config": {
      "priceMode": "percent",
      "tiers": [
        {
          "quantity": 2,
          "price": 10
        },
        {
          "quantity": 3,
          "price": 15,
          "freeDelivery": true
        }
      ]
    },
    "targets": [
      {
        "role": "buy",
        "refType": "product",
        "refId": "11"
      }
    ]
  }
}

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8
etag: W/"79-rZ65q366sk5cZEKdkvvZtqi3X2o"

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-21T06:29:43.923Z",
  "path": "/offers/preview"
}
```

### offers

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { offers { totalItems } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"b7-V7UNYeY3I3LcgOdTiWXMQ2JTa4A"

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
        "offers"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

