# List pricing options

The active store's groups, newest first, with the seeded "Platform default prices" table (D3112); `delivery.pricing.view`.

### GET /delivery-fees

```http
GET http://127.0.0.1:23100/delivery-fees
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"1e8-epWqMowiCeOqyXONsUiGE+Rc1KM"

{
  "items": [
    {
      "id": "<GROUP_SPARE>",
      "name": "خيار احتياطي",
      "carrierId": null,
      "isPlatformDefault": false,
      "createdAt": "2026-11-27T12:23:32.643Z"
    },
    {
      "id": "<GROUP_EVIDENCE>",
      "name": "خيار التسعير للأدلة",
      "carrierId": null,
      "isPlatformDefault": false,
      "createdAt": "2026-11-27T12:23:32.216Z"
    },
    {
      "id": "<GROUP_PLATFORM_DEFAULT>",
      "name": "أسعار المنصة الافتراضية",
      "carrierId": null,
      "isPlatformDefault": true,
      "createdAt": "2026-11-27T12:21:56.693Z"
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
etag: W/"9e-m0nHPBy+I3dCl4HZlll2uYX+tk4"

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

