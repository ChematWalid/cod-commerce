# Two businesses: cross-tenant

Business B's owner with A's ids, and A's owner with B's store. A foreign id is not found; a foreign store token is refused. The same email may be invited by both; only the second accept is refused, naming no business (D201).

### B lists its members: only its owner

```http
GET http://127.0.0.1:23100/employees?tab=all
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_OWNER_OF_B>",
      "administratorId": "3",
      "email": "owner@second.example.test",
      "firstName": "Second",
      "lastName": "Owner",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-13T12:11:50.729Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Second Owner",
      "roles": [
        {
          "id": "246970311340204032",
          "name": "Owner"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    }
  ],
  "counts": {
    "all": 1,
    "active": 1,
    "pending": 0,
    "inactive": 0
  },
  "total": 1
}
```

### B reads A's member: not found

```http
GET http://127.0.0.1:23100/employees/<MEMBER_AMINA>
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
  "path": "/employees/<MEMBER_AMINA>"
}
```

### B edits A's member: not found

```http
PATCH http://127.0.0.1:23100/employees/<MEMBER_AMINA>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "baseSalary": 0
}

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<MEMBER_AMINA>"
}
```

### B pays A's member: not found

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/pay
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "idempotencyKey": "evidence-b-1794571744"
}

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<MEMBER_AMINA>/pay"
}
```

### B removes A's member: not found

```http
DELETE http://127.0.0.1:23100/employees/<MEMBER_AMINA>
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
  "path": "/employees/<MEMBER_AMINA>"
}
```

### B reads A's commission: not found

```http
GET http://127.0.0.1:23100/commissions/configs/<COMMISSION_PERCENT>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "team.commission-not-found",
  "message": "Commission not found.",
  "path": "/commissions/configs/<COMMISSION_PERCENT>"
}
```

### B invites with A's role: not found, nothing stored, no mail

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "foreign-role@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 1,
  "locale": "en"
}

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "rbac.role-not-found",
  "message": "Role not found.",
  "path": "/employees"
}
```

### A's owner with B's store token: 403

```http
GET http://127.0.0.1:23100/employees?tab=all
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T12:13:54.665Z",
  "path": "/employees?tab=all"
}
```

### B invites the email A's member uses: allowed, invitations are per business (D201)

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "amina@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER_OF_B>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 1000,
  "locale": "en"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "246970831702331392",
  "administratorId": null,
  "email": "amina@invitee.example.test",
  "firstName": null,
  "lastName": null,
  "status": "invited",
  "commissionConfigIds": [],
  "baseSalary": 1000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-13T12:13:54.764Z",
  "joinedAt": null
}
```

### Accepting B's invitation with that email: refused, naming no business (D201)

```http
POST http://127.0.0.1:23100/team/invitations/accept
Content-Type: application/json

{
  "token": "[REDACTED]",
  "firstName": "Amina",
  "lastName": "Saadi",
  "password": "[REDACTED]"
}

HTTP/1.1 409 Conflict
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "team.account-elsewhere",
  "message": "This email already belongs to another business. Use a different email to join.",
  "path": "/team/invitations/accept"
}
```

