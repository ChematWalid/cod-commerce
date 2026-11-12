# Resend and revoke

A resend mails a new link and kills the old one (the hash is replaced). A second resend inside the minute is refused. A revoked link stops working.

### POST /employees/resend-invitation

```http
POST http://127.0.0.1:23100/employees/resend-invitation
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "memberId": "<MEMBER_PENDING>"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_PENDING>",
  "administratorId": null,
  "email": "pending@invitee.example.test",
  "firstName": null,
  "lastName": null,
  "status": "invited",
  "commissionConfigIds": [],
  "baseSalary": 20000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T18:32:57.689Z",
  "joinedAt": null
}
```

### The second mail in Mailpit

- From: no-reply@localhost
- To: pending@invitee.example.test
- Subject: Join the Demo team on CodShop

```text
Hello,

Demo Owner invited you to join the Demo team on CodShop. Use the button below to create your account and accept the invitation.

Accept invitation:
http://127.0.0.1:23100/dashboard/accept-invitation?token=[REDACTED_TOKEN]

The link is valid for 7 days and works once. If you did not expect this invitation, ignore this email.

CodShop
```

### The first link after the resend: refused

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

### The new link: answered

```http
GET http://127.0.0.1:23100/team/invitations/preview?token=[REDACTED]

HTTP/1.1 200 OK
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "email": "pending@invitee.example.test",
  "businessName": "Demo",
  "inviterName": "Demo Owner",
  "expiresAt": "2026-11-19T18:33:58.229Z"
}
```

### A second resend inside the minute: refused, no mail

```http
POST http://127.0.0.1:23100/employees/resend-invitation
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "memberId": "<MEMBER_PENDING>"
}

HTTP/1.1 429 Too Many Requests
cache-control: no-store
referrer-policy: no-referrer
content-type: application/json; charset=utf-8

{
  "statusCode": 429,
  "code": "team.resend-cooldown",
  "message": "The invitation was just sent. Wait a minute before sending it again.",
  "path": "/employees/resend-invitation"
}
```

### POST /employees/:id/revoke-invitation

```http
POST http://127.0.0.1:23100/employees/<MEMBER_PENDING>/revoke-invitation
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### The revoked link: the generic refusal

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

Mailpit check: pending@invitee.example.test received exactly 2 messages (the refused resend sent none).

