# Commission configs

Structure only (P7.S1 calculates). A percent value is in basis points, a fixed one in whole DZD. A config given to a member cannot be deleted.

### GET /commissions/configs/actions: the bases, labelled in Arabic and English

```http
GET http://127.0.0.1:23100/commissions/configs/actions
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "basis": "per-confirmed-order",
    "labels": {
      "ar": "لكل طلب مؤكَّد",
      "en": "Per confirmed order"
    }
  },
  {
    "basis": "per-delivered-order",
    "labels": {
      "ar": "لكل طلب مُسلَّم",
      "en": "Per delivered order"
    }
  }
]
```

### POST /commissions/configs: 150 DZD per confirmed order

```http
POST http://127.0.0.1:23100/commissions/configs
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Confirmed order bonus",
  "basis": "per-confirmed-order",
  "valueKind": "fixed",
  "value": 150,
  "scope": "all"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<COMMISSION_FIXED>",
  "name": "Confirmed order bonus",
  "basis": "per-confirmed-order",
  "valueKind": "fixed",
  "value": 150,
  "scope": "all",
  "storeIds": [],
  "createdAt": "2026-11-12T21:57:37.848Z",
  "updatedAt": "2026-11-12T21:57:37.848Z"
}
```

### POST /commissions/configs: 2.5 % per delivered order, one store

```http
POST http://127.0.0.1:23100/commissions/configs
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Delivered share",
  "basis": "per-delivered-order",
  "valueKind": "percent",
  "value": 250,
  "scope": "selected",
  "storeIds": [
    "<STORE_DEMO>"
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<COMMISSION_PERCENT>",
  "name": "Delivered share",
  "basis": "per-delivered-order",
  "valueKind": "percent",
  "value": 250,
  "scope": "selected",
  "storeIds": [
    "<STORE_DEMO>"
  ],
  "createdAt": "2026-11-12T21:57:37.981Z",
  "updatedAt": "2026-11-12T21:57:37.981Z"
}
```

### GET /commissions/configs

```http
GET http://127.0.0.1:23100/commissions/configs
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<COMMISSION_FIXED>",
    "name": "Confirmed order bonus",
    "basis": "per-confirmed-order",
    "valueKind": "fixed",
    "value": 150,
    "scope": "all",
    "storeIds": [],
    "createdAt": "2026-11-12T21:57:37.848Z",
    "updatedAt": "2026-11-12T21:57:37.848Z"
  },
  {
    "id": "<COMMISSION_PERCENT>",
    "name": "Delivered share",
    "basis": "per-delivered-order",
    "valueKind": "percent",
    "value": 250,
    "scope": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ],
    "createdAt": "2026-11-12T21:57:37.981Z",
    "updatedAt": "2026-11-12T21:57:37.981Z"
  }
]
```

### GET /commissions/configs/:id

```http
GET http://127.0.0.1:23100/commissions/configs/<COMMISSION_FIXED>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<COMMISSION_FIXED>",
  "name": "Confirmed order bonus",
  "basis": "per-confirmed-order",
  "valueKind": "fixed",
  "value": 150,
  "scope": "all",
  "storeIds": [],
  "createdAt": "2026-11-12T21:57:37.848Z",
  "updatedAt": "2026-11-12T21:57:37.848Z"
}
```

### PATCH /commissions/configs/:id

```http
PATCH http://127.0.0.1:23100/commissions/configs/<COMMISSION_FIXED>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "value": 200
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<COMMISSION_FIXED>",
  "name": "Confirmed order bonus",
  "basis": "per-confirmed-order",
  "valueKind": "fixed",
  "value": 200,
  "scope": "all",
  "storeIds": [],
  "createdAt": "2026-11-12T21:57:37.848Z",
  "updatedAt": "2026-11-12T21:57:38.293Z"
}
```

### PATCH /employees/:id: the member gets the commission

```http
PATCH http://127.0.0.1:23100/employees/<MEMBER_AMINA>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "commissionConfigIds": [
    "<COMMISSION_FIXED>"
  ]
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_AMINA>",
  "administratorId": "9",
  "email": "amina@invitee.example.test",
  "firstName": "Amina",
  "lastName": "Saadi",
  "status": "active",
  "commissionConfigIds": [
    "<COMMISSION_FIXED>"
  ],
  "baseSalary": 32000,
  "maxOpenOrders": 20,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T21:57:24.321Z",
  "joinedAt": "2026-11-12T21:57:28.742Z"
}
```

### DELETE /commissions/configs/:id while a member has it: refused

```http
DELETE http://127.0.0.1:23100/commissions/configs/<COMMISSION_FIXED>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 409 Conflict
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "team.commission-in-use",
  "message": "This commission is still given to a member.",
  "path": "/commissions/configs/<COMMISSION_FIXED>"
}
```

### DELETE /commissions/configs/:id once no member has it

```http
DELETE http://127.0.0.1:23100/commissions/configs/<COMMISSION_FIXED>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

