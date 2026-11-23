# List pricing options

The active store's groups, newest first, with the seeded "Platform default prices" table (D3112); `delivery.pricing.view`.

### GET /delivery-fees

```http
GET http://127.0.0.1:23100/delivery-fees
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"1d3-SShS1zt6izYG2A7Jw9lka4zi9JM"

{
  "items": [
    {
      "id": "<GROUP_SPARE>",
      "name": "خيار احتياطي",
      "carrierId": null,
      "isPlatformDefault": false,
      "createdAt": "2026-11-23T02:53:38.780Z"
    },
    {
      "id": "<GROUP_EVIDENCE>",
      "name": "خيار التسعير للأدلة",
      "carrierId": null,
      "isPlatformDefault": false,
      "createdAt": "2026-11-23T02:53:38.402Z"
    },
    {
      "id": "<GROUP_PLATFORM_DEFAULT>",
      "name": "Platform default prices",
      "carrierId": null,
      "isPlatformDefault": true,
      "createdAt": "2026-11-23T02:53:26.357Z"
    }
  ],
  "totalItems": 3
}
```

### deliveryFeeGroups (search)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query { deliveryFeeGroups(options: { search: \"التسعير\" }) { items { id name isPlatformDefault } totalItems } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"9e-7UdRna/To98PgTOjU6M1+sBjmjg"

{
  "data": {
    "deliveryFeeGroups": {
      "items": [
        {
          "id": "<GROUP_EVIDENCE>",
          "name": "خيار التسعير للأدلة",
          "isPlatformDefault": false
        }
      ],
      "totalItems": 1
    }
  }
}
```

