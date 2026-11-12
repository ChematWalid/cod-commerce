# Refusals

A duplicate email, the owner, a missing permission, anonymous, paying yourself, a double pay, a member outside a selected-store actor's reach, and the rate limits.

### Inviting a member's email again (other case, trailing space): refused

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "AMINA@invitee.example.test ",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 1,
  "locale": "en"
}

HTTP/1.1 409 Conflict
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 409,
  "code": "team.email-already-member",
  "message": "This email already belongs to a member of your team.",
  "path": "/employees"
}
```

### Removing the business owner: refused

```http
DELETE http://127.0.0.1:23100/employees/<MEMBER_OWNER>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "code": "team.owner-protected",
  "message": "The business owner cannot be changed this way.",
  "path": "/employees/<MEMBER_OWNER>"
}
```

### Paying your own member row: refused

```http
POST http://127.0.0.1:23100/employees/<MEMBER_OWNER>/pay
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "idempotencyKey": "evidence-self-1794520354"
}

HTTP/1.1 403 Forbidden
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "code": "team.self-action",
  "message": "You cannot do this on your own member account.",
  "path": "/employees/<MEMBER_OWNER>/pay"
}
```

### The same payment again (same idempotency key): the first payment, nothing new

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/pay
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "idempotencyKey": "evidence-pay-1794520354"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<PAYMENT>",
  "memberId": "<MEMBER_AMINA>",
  "amount": 32000,
  "idempotencyKey": "evidence-pay-1794520354",
  "paidByAdministratorId": "2",
  "paidAt": "2026-11-12T21:57:36.635Z"
}
```

Database check: one `salary_payment` row for the member after both calls.

### GET /employees without team.members.view: 403

```http
GET http://127.0.0.1:23100/employees
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-12T21:58:31.158Z",
  "path": "/employees"
}
```

### POST /employees without team.members.invite: 403

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "nobody@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 1,
  "locale": "en"
}

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-12T21:58:31.295Z",
  "path": "/employees"
}
```

### GET /employees, anonymous

```http
GET http://127.0.0.1:23100/employees

HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-12T21:58:31.349Z",
  "path": "/employees"
}
```

### A member on the first store only lists members: those on the second store or on all stores are not shown (D211)

```http
GET http://127.0.0.1:23100/employees?tab=all
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "246754769274675200",
      "administratorId": "8",
      "email": "perstore@demo.example.test",
      "firstName": "PerStore",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T21:55:21.477Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "PerStore Member",
      "roles": [
        {
          "id": "246754765889871872",
          "name": "Demo first store catalog"
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
    },
    {
      "id": "246754769215954944",
      "administratorId": "4",
      "email": "limited@demo.example.test",
      "firstName": "Limited",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T21:55:21.463Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Limited Member",
      "roles": [
        {
          "id": "<ROLE_DEMO_VIEWER>",
          "name": "Demo viewer"
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
    "all": 2,
    "active": 2,
    "pending": 0,
    "inactive": 0
  },
  "total": 2
}
```

### The same member opens one invited onto the second store: not found

```http
GET http://127.0.0.1:23100/employees/<MEMBER_SECOND_STORE_ONLY>
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
  "path": "/employees/<MEMBER_SECOND_STORE_ONLY>"
}
```

### The same member limits one who works on all stores: not found

```http
POST http://127.0.0.1:23100/employees/<MEMBER_AMINA>/limit
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "maxOpenOrders": 3
}

HTTP/1.1 404 Not Found
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<MEMBER_AMINA>/limit"
}
```

### Preview past the per-address budget (60 a minute): 429

```http
GET http://127.0.0.1:23100/team/invitations/preview?token=[REDACTED]

HTTP/1.1 429 Too Many Requests
cache-control: no-store
referrer-policy: no-referrer
retry-after: 1
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 1,
  "path": "/team/invitations/preview"
}
```

### Accept from the same address, at once: 429

```http
POST http://127.0.0.1:23100/team/invitations/accept
Content-Type: application/json

{
  "token": "[REDACTED]",
  "firstName": "Late",
  "lastName": "Comer",
  "password": "[REDACTED]"
}

HTTP/1.1 429 Too Many Requests
cache-control: no-store
referrer-policy: no-referrer
retry-after: 1
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 1,
  "path": "/team/invitations/accept"
}
```

### Business B's owner after 30 invites this hour (each refused, so none mailed): 429

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "late@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER_OF_B>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 1,
  "locale": "en"
}

HTTP/1.1 429 Too Many Requests
retry-after: 118
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "message": "Too many requests. Try again later.",
  "retryAfterSeconds": 118,
  "path": "/employees"
}
```

