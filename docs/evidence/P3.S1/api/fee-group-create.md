# Create a pricing option

A new fee group of the active store (store from the session, never the body); `delivery.pricing.create`. Every wilaya's row is given; prices are whole DZD.

### POST /delivery-fees

```http
POST http://127.0.0.1:23100/delivery-fees
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
      "homePrice": 650,
      "deskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    {
      "provinceCode": "02",
      "homePrice": 650,
      "deskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    "… 67 more wilayas, Alger (16) as listed in the text"
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
etag: W/"2ab6-5oLLbUofytqrm7D4VWr92OD0nOw"

{
  "id": "<GROUP_EVIDENCE>",
  "name": "خيار التسعير للأدلة",
  "carrierId": null,
  "chargeOverweight": true,
  "overweightAllowanceKg": 5,
  "overweightRate": 50,
  "isPlatformDefault": false,
  "createdAt": "2026-11-23T02:53:38.402Z",
  "updatedAt": "2026-11-23T02:53:38.402Z",
  "rates": [
    {
      "provinceCode": "01",
      "homePrice": 650,
      "deskPrice": 400,
      "baseHomePrice": 1100,
      "baseDeskPrice": 600,
      "deliveryEnabled": true,
      "deskEnabled": true,
      "overridden": true
    },
    {
      "provinceCode": "02",
      "homePrice": 650,
      "deskPrice": 400,
      "baseHomePrice": 690,
      "baseDeskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true,
      "overridden": true
    },
    {
      "provinceCode": "16",
      "homePrice": 650,
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

### createDeliveryFeeGroup

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: $input) { id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault } }",
  "variables": {
    "input": {
      "name": "خيار احتياطي",
      "carrierId": null,
      "chargeOverweight": true,
      "overweightAllowanceKg": 5,
      "overweightRate": 50,
      "rates": [
        {
          "provinceCode": "01",
          "homePrice": 700,
          "deskPrice": 400,
          "deliveryEnabled": true,
          "deskEnabled": true
        },
        {
          "provinceCode": "02",
          "homePrice": 700,
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
etag: W/"d2-mowP4q4iyN10vnXdrNqCARUPp1o"

{
  "data": {
    "createDeliveryFeeGroup": {
      "id": "<GROUP_SPARE>",
      "name": "خيار احتياطي",
      "carrierId": null,
      "chargeOverweight": true,
      "overweightAllowanceKg": 5,
      "overweightRate": 50,
      "isPlatformDefault": false
    }
  }
}
```

