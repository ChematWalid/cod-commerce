# Wilaya as the store offers it (signed)

For the storefront server only, signed (D112, D3106): Alger's communes narrowed by the store's default table, Casbah without home delivery. The signed `x-store-id` must name the queried store (D3135).

### GET /store/provinces/code/16?storeId=<demo>

```http
GET http://127.0.0.1:23100/store/provinces/code/16?storeId=<STORE_DEMO>
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 200 OK
cache-control: private, no-store
content-type: application/json; charset=utf-8
etag: W/"26d2-AgGAhzkdwR5nT3J7Lr3QvLhYXP0"

{
  "id": "16",
  "code": "16",
  "name": "Alger",
  "arabicName": "الجزائر",
  "names": [
    "الجزائر",
    "Algiers",
    "El Djazair"
  ],
  "towns": [
    {
      "id": "1601",
      "codeOns": 1601,
      "provinceCode": "16",
      "name": "Alger Centre",
      "arabicName": "الجزائر الوسطى",
      "names": [
        "الجزائر الوسطى"
      ],
      "isStopdesk": true,
      "isHomeDelivery": true
    },
    {
      "id": "1602",
      "codeOns": 1602,
      "provinceCode": "16",
      "name": "Sidi M'Hamed",
      "arabicName": "سيدي امحمد",
      "names": [
        "سيدي امحمد"
      ],
      "isStopdesk": true,
      "isHomeDelivery": true
    },
    {
      "id": "1603",
      "codeOns": 1603,
      "provinceCode": "16",
      "name": "El Madania",
      "arabicName": "المدنية",
      "names": [
        "المدنية"
      ],
      "isStopdesk": false,
      "isHomeDelivery": true
    },
    {
      "id": "1607",
      "codeOns": 1607,
      "provinceCode": "16",
      "name": "Casbah",
      "arabicName": "القصبة",
      "names": [
        "القصبة"
      ],
      "isStopdesk": false,
      "isHomeDelivery": false
    }
  ],
  "townsShown": "4 of 57"
}
```

### GET /store/provinces/code/16?storeId=<second> signed for <demo>: 404

```http
GET http://127.0.0.1:23100/store/provinces/code/16?storeId=<STORE_SECOND>
x-internal-kid: k1
x-internal-ts: <unix seconds>
x-internal-sig: [REDACTED]
x-store-id: <STORE_DEMO>

HTTP/1.1 404 Not Found
cache-control: private, no-store
content-type: application/json; charset=utf-8
etag: W/"6e-jMwR2EdC///wMQCISbo2uq2WOF8"

{
  "statusCode": 404,
  "code": "geo.store-not-found",
  "message": "Store not found.",
  "path": "/store/provinces/code/16"
}
```

### GET /store/provinces/code/16 unsigned: 404, empty body (D112)

```http
GET http://127.0.0.1:23100/store/provinces/code/16?storeId=<STORE_DEMO>

HTTP/1.1 404 Not Found

```

