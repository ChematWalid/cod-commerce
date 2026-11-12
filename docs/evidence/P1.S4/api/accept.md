# Preview and accept

Public REST routes (D205): no session, the token in the query or body (redacted here), never cached nor referred. The password is redacted. A used link answers the same opaque refusal as an unknown one.

### GET /team/invitations/preview

```http
GET http://127.0.0.1:23100/team/invitations/preview?token=[REDACTED]

HTTP/1.1 200 OK
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "email": "amina@invitee.example.test",
  "businessName": "Demo",
  "inviterName": "Demo Owner",
  "expiresAt": "2026-11-19T21:57:24.321Z"
}
```

### POST /team/invitations/accept

```http
POST http://127.0.0.1:23100/team/invitations/accept
Content-Type: application/json

{
  "token": "[REDACTED]",
  "firstName": "Amina",
  "lastName": "Saadi",
  "password": "[REDACTED]"
}

HTTP/1.1 200 OK
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "businessId": "<BUSINESS_DEMO>"
}
```

### The used link, previewed again: the generic refusal

```http
GET http://127.0.0.1:23100/team/invitations/preview?token=[REDACTED]

HTTP/1.1 400 Bad Request
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 400,
  "code": "team.invitation-invalid",
  "message": "This invitation link cannot be used. Ask for a new invitation.",
  "path": "/team/invitations/preview"
}
```

### The used link, accepted again: refused, no second account

```http
POST http://127.0.0.1:23100/team/invitations/accept
Content-Type: application/json

{
  "token": "[REDACTED]",
  "firstName": "Amina",
  "lastName": "Saadi",
  "password": "[REDACTED]"
}

HTTP/1.1 400 Bad Request
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 400,
  "code": "team.invitation-invalid",
  "message": "This invitation link cannot be used. Ask for a new invitation.",
  "path": "/team/invitations/accept"
}
```

Database check: one administrator for amina@invitee.example.test.

