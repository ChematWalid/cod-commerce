# Read a pricing option

The group with its wilaya rows (cut to three here) and its commune overrides; `delivery.pricing.view`.

### GET /delivery-fees/:id

```http
GET http://127.0.0.1:23100/delivery-fees/<GROUP_EVIDENCE>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2c62-YZ2hMtzVoujZz0ArlCJiLjlTvxs"

{
  "id": "<GROUP_EVIDENCE>",
  "name": "خيار التسعير للأدلة",
  "carrierId": null,
  "chargeOverweight": true,
  "overweightAllowanceKg": 5,
  "overweightRate": 50,
  "isPlatformDefault": false,
  "createdAt": "2026-11-23T02:53:38.402Z",
  "updatedAt": "2026-11-23T02:53:39.808Z",
  "rates": [
    {
      "provinceCode": "01",
      "homePrice": 1100,
      "deskPrice": 600,
      "baseHomePrice": 1100,
      "baseDeskPrice": 600,
      "deliveryEnabled": true,
      "deskEnabled": true,
      "overridden": false
    },
    {
      "provinceCode": "02",
      "homePrice": 690,
      "deskPrice": 400,
      "baseHomePrice": 690,
      "baseDeskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true,
      "overridden": false
    },
    {
      "provinceCode": "16",
      "homePrice": 750,
      "deskPrice": 400,
      "baseHomePrice": 500,
      "baseDeskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true,
      "overridden": true
    }
  ],
  "communeRates": [
    {
      "codeOns": 1601,
      "provinceCode": "16",
      "homePrice": 777,
      "deskPrice": null,
      "baseHomePrice": null,
      "baseDeskPrice": null,
      "deliveryEnabled": null,
      "deskEnabled": null,
      "overridden": true
    },
    {
      "codeOns": 1607,
      "provinceCode": "16",
      "homePrice": null,
      "deskPrice": null,
      "baseHomePrice": null,
      "baseDeskPrice": null,
      "deliveryEnabled": false,
      "deskEnabled": null,
      "overridden": false
    }
  ],
  "ratesShown": "3 of 69"
}
```

### deliveryFeeGroup(id)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { deliveryFeeGroup(id: $id) { id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault rates { provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled deskEnabled overridden } communeRates { codeOns provinceCode homePrice deskPrice baseHomePrice deliveryEnabled deskEnabled overridden } } }",
  "variables": {
    "id": "<GROUP_EVIDENCE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"2c09-i+JsYsl+QzkyIub5nmSj89d7pfw"

{
  "data": {
    "deliveryFeeGroup": {
      "id": "<GROUP_EVIDENCE>",
      "name": "خيار التسعير للأدلة",
      "carrierId": null,
      "chargeOverweight": true,
      "overweightAllowanceKg": 5,
      "overweightRate": 50,
      "isPlatformDefault": false,
      "rates": [
        {
          "provinceCode": "01",
          "homePrice": 1100,
          "deskPrice": 600,
          "baseHomePrice": 1100,
          "baseDeskPrice": 600,
          "deliveryEnabled": true,
          "deskEnabled": true,
          "overridden": false
        },
        {
          "provinceCode": "02",
          "homePrice": 690,
          "deskPrice": 400,
          "baseHomePrice": 690,
          "baseDeskPrice": 400,
          "deliveryEnabled": true,
          "deskEnabled": true,
          "overridden": false
        },
        {
          "provinceCode": "16",
          "homePrice": 750,
          "deskPrice": 400,
          "baseHomePrice": 500,
          "baseDeskPrice": 400,
          "deliveryEnabled": true,
          "deskEnabled": true,
          "overridden": true
        }
      ],
      "communeRates": [
        {
          "codeOns": 1601,
          "provinceCode": "16",
          "homePrice": 777,
          "deskPrice": null,
          "baseHomePrice": null,
          "deliveryEnabled": null,
          "deskEnabled": null,
          "overridden": true
        },
        {
          "codeOns": 1607,
          "provinceCode": "16",
          "homePrice": null,
          "deskPrice": null,
          "baseHomePrice": null,
          "deliveryEnabled": false,
          "deskEnabled": null,
          "overridden": false
        }
      ],
      "ratesShown": "3 of 69"
    }
  }
}
```

