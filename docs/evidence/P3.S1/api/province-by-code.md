# One wilaya with its communes (public)

`16`, `01` or `1` (D3115); the answer names the two-digit code. Communes cut to three in the transcript.

### GET /provinces/code/16

```http
GET http://127.0.0.1:23100/provinces/code/16

HTTP/1.1 200 OK
cache-control: public, max-age=300, stale-while-revalidate=86400
content-type: application/json; charset=utf-8
etag: W/"26d1-9DQydZJdZlL9QWxnNnJUXKZexhk"

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
      "isHomeDelivery": true
    }
  ],
  "townsShown": "4 of 57"
}
```

### GET /provinces/code/1: the answer names 01

```http
GET http://127.0.0.1:23100/provinces/code/1

HTTP/1.1 200 OK
cache-control: public, max-age=300, stale-while-revalidate=86400
content-type: application/json; charset=utf-8
etag: W/"a3e-qY1UN0HrUY+Ma+EIgyTQobLG3pI"

{
  "id": "01",
  "code": "01",
  "name": "Adrar",
  "arabicName": "أدرار",
  "names": [
    "أدرار"
  ],
  "towns": [
    {
      "id": "101",
      "codeOns": 101,
      "provinceCode": "01",
      "name": "Adrar",
      "arabicName": "أدرار",
      "names": [
        "أدرار"
      ],
      "isStopdesk": true,
      "isHomeDelivery": true
    },
    {
      "id": "102",
      "codeOns": 102,
      "provinceCode": "01",
      "name": "Tamest",
      "arabicName": "تامست",
      "names": [
        "تامست"
      ],
      "isStopdesk": false,
      "isHomeDelivery": true
    },
    {
      "id": "104",
      "codeOns": 104,
      "provinceCode": "01",
      "name": "Reggane",
      "arabicName": "رقان",
      "names": [
        "رقان"
      ],
      "isStopdesk": true,
      "isHomeDelivery": true
    }
  ],
  "townsShown": "3 of 16"
}
```

### GET /provinces/code/70: 404

```http
GET http://127.0.0.1:23100/provinces/code/70

HTTP/1.1 404 Not Found
cache-control: public, max-age=300, stale-while-revalidate=86400
content-type: application/json; charset=utf-8
etag: W/"6c-YopLgQEKgAW2CttaJYwjRcz9ts8"

{
  "statusCode": 404,
  "code": "geo.province-not-found",
  "message": "Wilaya not found.",
  "path": "/provinces/code/70"
}
```

