# Commune overrides

One wilaya's communes in one call (D3125): Alger-Centre home 777, Casbah home delivery off; `null` inherits the wilaya.

### PUT /delivery-fees/:id/communes/16

```http
PUT http://127.0.0.1:23100/delivery-fees/<GROUP_EVIDENCE>/communes/16
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "rows": [
    {
      "codeOns": 1601,
      "homePrice": 777,
      "deskPrice": null,
      "deliveryEnabled": null,
      "deskEnabled": null
    },
    {
      "codeOns": 1607,
      "homePrice": null,
      "deskPrice": null,
      "deliveryEnabled": false,
      "deskEnabled": null
    }
  ]
}

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

### setDeliveryFeeCommuneRates

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($groupId: String!, $rows: [DeliveryFeeCommuneRateInput!]!) { setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: \"16\", rows: $rows) { id communeRates { codeOns homePrice deliveryEnabled overridden } } }",
  "variables": {
    "groupId": "<GROUP_EVIDENCE>",
    "rows": [
      {
        "codeOns": 1601,
        "homePrice": 777,
        "deskPrice": null,
        "deliveryEnabled": null,
        "deskEnabled": null
      },
      {
        "codeOns": 1607,
        "homePrice": null,
        "deskPrice": null,
        "deliveryEnabled": false,
        "deskEnabled": null
      }
    ]
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"ec-dIWwOa3C89bxPrncJhfcicLoXoU"

{
  "data": {
    "setDeliveryFeeCommuneRates": {
      "id": "<GROUP_EVIDENCE>",
      "communeRates": [
        {
          "codeOns": 1601,
          "homePrice": 777,
          "deliveryEnabled": null,
          "overridden": true
        },
        {
          "codeOns": 1607,
          "homePrice": null,
          "deliveryEnabled": false,
          "overridden": false
        }
      ]
    }
  }
}
```

