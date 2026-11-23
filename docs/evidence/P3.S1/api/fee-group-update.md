# Edit a pricing option

Every row is sent; a price different from its base (the platform default table) is stored as an override (D3107). The option created at 650 everywhere is sent back at each wilaya's base price with Alger at 750: Alger is `overridden`, the wilayas at their base are not.

### PUT /delivery-fees/:id (Alger home 750)

```http
PUT http://127.0.0.1:23100/delivery-fees/<GROUP_EVIDENCE>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "خيار التسعير للأدلة",
  "carrierId": null,
  "chargeOverweight": true,
  "overweightAllowanceKg": 5,
  "overweightRate": 50,
  "rates": [
    {
      "provinceCode": "01",
      "homePrice": 1100,
      "deskPrice": 600,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    {
      "provinceCode": "02",
      "homePrice": 690,
      "deskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    "… 67 more wilayas, Alger (16) as listed in the text"
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2b08-LNRXKkOI9xIpJUWPbtA5YE5VaaQ"

{
  "id": "<GROUP_EVIDENCE>",
  "name": "خيار التسعير للأدلة",
  "carrierId": null,
  "chargeOverweight": true,
  "overweightAllowanceKg": 5,
  "overweightRate": 50,
  "isPlatformDefault": false,
  "createdAt": "2026-11-23T02:53:38.402Z",
  "updatedAt": "2026-11-23T02:53:39.491Z",
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
  "communeRates": [],
  "ratesShown": "3 of 69"
}
```

### updateDeliveryFeeGroup

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($id: String!, $input: DeliveryFeeGroupInput!) { updateDeliveryFeeGroup(id: $id, input: $input) { id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault } }",
  "variables": {
    "id": "<GROUP_EVIDENCE>",
    "input": {
      "name": "خيار التسعير للأدلة",
      "carrierId": null,
      "chargeOverweight": true,
      "overweightAllowanceKg": 5,
      "overweightRate": 50,
      "rates": [
        {
          "provinceCode": "01",
          "homePrice": 1100,
          "deskPrice": 600,
          "deliveryEnabled": true,
          "deskEnabled": true
        },
        {
          "provinceCode": "02",
          "homePrice": 690,
          "deskPrice": 400,
          "deliveryEnabled": true,
          "deskEnabled": true
        },
        "… 67 more wilayas, Alger (16) as listed in the text"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"df-A7K2oQt7MSQ2w5yFcHqHdSciMM4"

{
  "data": {
    "updateDeliveryFeeGroup": {
      "id": "<GROUP_EVIDENCE>",
      "name": "خيار التسعير للأدلة",
      "carrierId": null,
      "chargeOverweight": true,
      "overweightAllowanceKg": 5,
      "overweightRate": 50,
      "isPlatformDefault": false
    }
  }
}
```

