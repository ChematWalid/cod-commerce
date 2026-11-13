# Member actions

Edit, limit, stop and resume receiving orders, deactivate and reactivate, pay salary, order managers and remove. Pay salary is a placeholder: it books one row and writes `salary.paid` to the outbox in the same transaction (P6.S4 books the ledger).

### PATCH /employees/:id: the base salary

```http
PATCH http://127.0.0.1:23100/employees/<MEMBER_AMINA>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "baseSalary": 32000
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
  "commissionConfigIds": [],
  "baseSalary": 32000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:12:44.626Z",
  "joinedAt": "2026-11-13T12:12:47.051Z"
}
```

### POST /employees/:id/limit

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/limit
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "maxOpenOrders": 20
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
  "commissionConfigIds": [],
  "baseSalary": 32000,
  "maxOpenOrders": 20,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:12:44.626Z",
  "joinedAt": "2026-11-13T12:12:47.051Z"
}
```

### POST /employees/:id/receiving: stop receiving orders (the status stays active)

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/receiving
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "receivingOrders": false
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
  "commissionConfigIds": [],
  "baseSalary": 32000,
  "maxOpenOrders": 20,
  "receivingOrders": false,
  "invitedAt": "2026-11-13T12:12:44.626Z",
  "joinedAt": "2026-11-13T12:12:47.051Z"
}
```

### GET /employees/order-managers: a member who stopped receiving is not offered

```http
GET http://127.0.0.1:23100/employees/order-managers
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<MEMBER_KARIM>",
    "name": "Karim Haddad",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "246970321066795008",
    "name": "PerStore Member",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "246970321054212096",
    "name": "SettingsView Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321037434880",
    "name": "NoView Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321020657664",
    "name": "Orders Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321003880448",
    "name": "Limited Member",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "<MEMBER_OWNER>",
    "name": "Demo Owner",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  }
]
```

### POST /employees/:id/receiving: resume

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/receiving
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "receivingOrders": true
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
  "commissionConfigIds": [],
  "baseSalary": 32000,
  "maxOpenOrders": 20,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:12:44.626Z",
  "joinedAt": "2026-11-13T12:12:47.051Z"
}
```

### GET /employees/order-managers: active members receiving orders, with their limit (D209)

```http
GET http://127.0.0.1:23100/employees/order-managers
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<MEMBER_KARIM>",
    "name": "Karim Haddad",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "<MEMBER_AMINA>",
    "name": "Amina Saadi",
    "maxOpenOrders": 20,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321066795008",
    "name": "PerStore Member",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "246970321054212096",
    "name": "SettingsView Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321037434880",
    "name": "NoView Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321020657664",
    "name": "Orders Member",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  },
  {
    "id": "246970321003880448",
    "name": "Limited Member",
    "maxOpenOrders": null,
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_DEMO>"
    ]
  },
  {
    "id": "<MEMBER_OWNER>",
    "name": "Demo Owner",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  }
]
```

### POST /employees/:id/deactivate

```http
POST http://127.0.0.1:23100/employees/<MEMBER_KARIM>/deactivate
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_KARIM>",
  "administratorId": "10",
  "email": "karim@invitee.example.test",
  "firstName": "Karim",
  "lastName": "Haddad",
  "status": "inactive",
  "commissionConfigIds": [],
  "baseSalary": 25000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:12:45.381Z",
  "joinedAt": "2026-11-13T12:12:48.120Z"
}
```

Database check: the deactivated member holds no role assignment (D204).

### GET /employees?tab=inactive

```http
GET http://127.0.0.1:23100/employees?tab=inactive
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_KARIM>",
      "administratorId": "10",
      "email": "karim@invitee.example.test",
      "firstName": "Karim",
      "lastName": "Haddad",
      "status": "inactive",
      "commissionConfigIds": [],
      "baseSalary": 25000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-13T12:12:45.381Z",
      "joinedAt": "2026-11-13T12:12:48.120Z",
      "tab": "inactive",
      "invitationExpired": false,
      "name": "Karim Haddad",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    }
  ],
  "counts": {
    "all": 10,
    "active": 7,
    "pending": 2,
    "inactive": 1
  },
  "total": 1
}
```

### POST /employees/:id/reactivate: the roles and stores held before come back

```http
POST http://127.0.0.1:23100/employees/<MEMBER_KARIM>/reactivate
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_KARIM>",
  "administratorId": "10",
  "email": "karim@invitee.example.test",
  "firstName": "Karim",
  "lastName": "Haddad",
  "status": "active",
  "commissionConfigIds": [],
  "baseSalary": 25000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:12:45.381Z",
  "joinedAt": "2026-11-13T12:12:48.120Z"
}
```

### POST /employees/:id/pay: the base salary, once

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/pay
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "idempotencyKey": "evidence-pay-1794571744"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<PAYMENT>",
  "memberId": "<MEMBER_AMINA>",
  "amount": 32000,
  "idempotencyKey": "evidence-pay-1794571744",
  "paidByAdministratorId": "2",
  "paidAt": "2026-11-13T12:12:51.544Z"
}
```

### DELETE /employees/:id

```http
DELETE http://127.0.0.1:23100/employees/<MEMBER_KARIM>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### GET /employees/:id of the removed member: not found

```http
GET http://127.0.0.1:23100/employees/<MEMBER_KARIM>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<MEMBER_KARIM>"
}
```

Database check: the removed member's administrator is soft-deleted.

