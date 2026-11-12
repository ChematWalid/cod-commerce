# Invite

The owner invites by email with a role, store access and a base salary in whole DZD. The member is listed as pending; the invitation mail arrives in Mailpit in the chosen language. The link's token is redacted below; the server stores only its SHA-256 (D205).

### POST /employees: all stores, English mail

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "amina@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "all",
  "storeIds": [],
  "baseSalary": 30000,
  "locale": "en"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_AMINA>",
  "administratorId": null,
  "email": "amina@invitee.example.test",
  "firstName": null,
  "lastName": null,
  "status": "invited",
  "commissionConfigIds": [],
  "baseSalary": 30000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T21:57:24.321Z",
  "joinedAt": null
}
```

### The English invitation mail in Mailpit

- From: no-reply@localhost
- To: amina@invitee.example.test
- Subject: Join the Demo team on CodShop

```text
Hello,

Demo Owner invited you to join the Demo team on CodShop. Use the button below to create your account and accept the invitation.

Accept invitation:
http://127.0.0.1:23100/dashboard/accept-invitation?token=[REDACTED_TOKEN]

The link is valid for 7 days and works once. If you did not expect this invitation, ignore this email.

CodShop
```

### POST /employees: one store, Arabic mail

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "karim@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "selected",
  "storeIds": [
    "<STORE_DEMO>"
  ],
  "baseSalary": 25000,
  "locale": "ar"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_KARIM>",
  "administratorId": null,
  "email": "karim@invitee.example.test",
  "firstName": null,
  "lastName": null,
  "status": "invited",
  "commissionConfigIds": [],
  "baseSalary": 25000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T21:57:25.475Z",
  "joinedAt": null
}
```

### The Arabic invitation mail in Mailpit

- From: no-reply@localhost
- To: karim@invitee.example.test
- Subject: دعوة للانضمام إلى فريق ⁨Demo⁩ على CodShop

```text
مرحبًا،

دعاك ⁨Demo Owner⁩ للانضمام إلى فريق ⁨Demo⁩ على CodShop. اضغط على الزر أدناه لإنشاء حسابك وقبول الدعوة.

قبول الدعوة:
http://127.0.0.1:23100/dashboard/accept-invitation?token=[REDACTED_TOKEN]

الرابط صالح لمدة 7 أيام ويعمل مرة واحدة فقط. إذا لم تكن تتوقع هذه الدعوة، تجاهل هذه الرسالة.

CodShop
```

### POST /employees: the second store only (used by the store-reach refusal)

```http
POST http://127.0.0.1:23100/employees
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "email": "second-store@invitee.example.test",
  "roleIds": [
    "<ROLE_ORDER_MANAGER>"
  ],
  "storeAccess": "selected",
  "storeIds": [
    "<STORE_DEMO2>"
  ],
  "baseSalary": 20000,
  "locale": "en"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_SECOND_STORE_ONLY>",
  "administratorId": null,
  "email": "second-store@invitee.example.test",
  "firstName": null,
  "lastName": null,
  "status": "invited",
  "commissionConfigIds": [],
  "baseSalary": 20000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T21:57:27.311Z",
  "joinedAt": null
}
```

Database check: 4 invitation rows, each `tokenHash` is 64 hex characters (a SHA-256); no column holds the raw token.

