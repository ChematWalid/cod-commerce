# Admin API (GraphQL)

The operations the dashboard sends, by its operation names, on the Demo store. Two members are invited here: one is accepted (through the REST route shown in `accept.md`) and goes through every member action until it is removed; the other is resent and revoked. A commission is created, read, changed and deleted.

### inviteMember (TeamInvite): one store, Arabic mail

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamInvite($input: InviteMemberInput!) { inviteMember(input: $input) { id email status baseSalary } }",
  "variables": {
    "input": {
      "email": "graphql-active-1794571744@invitee.example.test",
      "roleIds": [
        "<ROLE_ORDER_MANAGER>"
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "baseSalary": 18000,
      "locale": "ar"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "inviteMember": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "email": "graphql-active-1794571744@invitee.example.test",
      "status": "invited",
      "baseSalary": 18000
    }
  }
}
```

### teamMember: the accepted member

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamMember($id: String!) { teamMember(id: $id) { id email name status tab roles { name } storeAccess storeIds baseSalary maxOpenOrders receivingOrders } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamMember": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "email": "graphql-active-1794571744@invitee.example.test",
      "name": "Nadia Ferhat",
      "status": "active",
      "tab": "active",
      "roles": [
        {
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "baseSalary": 18000,
      "maxOpenOrders": null,
      "receivingOrders": true
    }
  }
}
```

### updateTeamMember (TeamUpdate): the base salary

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamUpdate($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id status baseSalary } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>",
    "input": {
      "baseSalary": 19000
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateTeamMember": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "active",
      "baseSalary": 19000
    }
  }
}
```

### setTeamMemberLimit (TeamLimit)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamLimit($id: String!, $max: Int) { setTeamMemberLimit(id: $id, maxOpenOrders: $max) { id status maxOpenOrders } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>",
    "max": 15
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTeamMemberLimit": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "active",
      "maxOpenOrders": 15
    }
  }
}
```

### setTeamMemberReceiving (TeamReceiving): stop

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamReceiving($id: String!, $on: Boolean!) { setTeamMemberReceiving(id: $id, receivingOrders: $on) { id status receivingOrders } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>",
    "on": false
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTeamMemberReceiving": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "active",
      "receivingOrders": false
    }
  }
}
```

### teamOrderManagers: a member who stopped receiving is not offered

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamOrderManagers { teamOrderManagers { id name maxOpenOrders storeAccess storeIds } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamOrderManagers": [
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
  }
}
```

### setTeamMemberReceiving (TeamReceiving): resume

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamReceiving($id: String!, $on: Boolean!) { setTeamMemberReceiving(id: $id, receivingOrders: $on) { id status receivingOrders } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>",
    "on": true
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setTeamMemberReceiving": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "active",
      "receivingOrders": true
    }
  }
}
```

### teamOrderManagers: offered again, with its limit

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamOrderManagers { teamOrderManagers { id name maxOpenOrders storeAccess storeIds } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamOrderManagers": [
      {
        "id": "<MEMBER_GQL_ACTIVE>",
        "name": "Nadia Ferhat",
        "maxOpenOrders": 15,
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
  }
}
```

### deactivateTeamMember (TeamDeactivate)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamDeactivate($id: String!) { deactivateTeamMember(id: $id) { id status } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deactivateTeamMember": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "inactive"
    }
  }
}
```

### reactivateTeamMember (TeamReactivate)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamReactivate($id: String!) { reactivateTeamMember(id: $id) { id status } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "reactivateTeamMember": {
      "id": "<MEMBER_GQL_ACTIVE>",
      "status": "active"
    }
  }
}
```

### payTeamMember (TeamPay): the base salary, once per key

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamPay($id: String!, $key: String!) { payTeamMember(id: $id, idempotencyKey: $key) { id memberId amount paidAt } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>",
    "key": "evidence-gql-pay-1794571744"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "payTeamMember": {
      "id": "<PAYMENT_GQL>",
      "memberId": "<MEMBER_GQL_ACTIVE>",
      "amount": 19000,
      "paidAt": "2026-11-13T12:13:59.464Z"
    }
  }
}
```

### removeTeamMember (TeamRemove)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamRemove($id: String!) { removeTeamMember(id: $id) }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "removeTeamMember": true
  }
}
```

### teamMember of the removed member: not found

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamMember($id: String!) { teamMember(id: $id) { id email name status tab roles { name } storeAccess storeIds baseSalary maxOpenOrders receivingOrders } }",
  "variables": {
    "id": "<MEMBER_GQL_ACTIVE>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 34
        }
      ],
      "path": [
        "teamMember"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### teamCommissionBases (TeamCommissionBases)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamCommissionBases { teamCommissionBases { basis labels { ar en } } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamCommissionBases": [
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
  }
}
```

### createTeamCommissionConfig (TeamCreateCommission): 120 DZD per confirmed order

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamCreateCommission($input: TeamCommissionConfigInput!) { createTeamCommissionConfig(input: $input) { id name basis valueKind value scope storeIds } }",
  "variables": {
    "input": {
      "name": "Admin API bonus",
      "basis": "per-confirmed-order",
      "valueKind": "fixed",
      "value": 120,
      "scope": "all"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "createTeamCommissionConfig": {
      "id": "<COMMISSION_GQL>",
      "name": "Admin API bonus",
      "basis": "per-confirmed-order",
      "valueKind": "fixed",
      "value": 120,
      "scope": "all",
      "storeIds": []
    }
  }
}
```

### teamCommissionConfig

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamCommissionConfig($id: String!) { teamCommissionConfig(id: $id) { id name basis valueKind value scope storeIds } }",
  "variables": {
    "id": "<COMMISSION_GQL>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamCommissionConfig": {
      "id": "<COMMISSION_GQL>",
      "name": "Admin API bonus",
      "basis": "per-confirmed-order",
      "valueKind": "fixed",
      "value": 120,
      "scope": "all",
      "storeIds": []
    }
  }
}
```

### updateTeamCommissionConfig

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamUpdateCommission($id: String!, $input: UpdateTeamCommissionConfigInput!) { updateTeamCommissionConfig(id: $id, input: $input) { id name value } }",
  "variables": {
    "id": "<COMMISSION_GQL>",
    "input": {
      "value": 140
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "updateTeamCommissionConfig": {
      "id": "<COMMISSION_GQL>",
      "name": "Admin API bonus",
      "value": 140
    }
  }
}
```

### teamCommissionConfigs (TeamCommissionConfigs)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query TeamCommissionConfigs { teamCommissionConfigs { id name basis valueKind value } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamCommissionConfigs": [
      {
        "id": "<COMMISSION_GQL>",
        "name": "Admin API bonus",
        "basis": "per-confirmed-order",
        "valueKind": "fixed",
        "value": 140
      },
      {
        "id": "<COMMISSION_PERCENT>",
        "name": "Delivered share",
        "basis": "per-delivered-order",
        "valueKind": "percent",
        "value": 250
      }
    ]
  }
}
```

### deleteTeamCommissionConfig

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamDeleteCommission($id: String!) { deleteTeamCommissionConfig(id: $id) }",
  "variables": {
    "id": "<COMMISSION_GQL>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "deleteTeamCommissionConfig": true
  }
}
```

### resendInvitation (TeamResend)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamResend($id: String!) { resendInvitation(memberId: $id) { id status } }",
  "variables": {
    "id": "<MEMBER_GQL_PENDING>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "resendInvitation": {
      "id": "<MEMBER_GQL_PENDING>",
      "status": "invited"
    }
  }
}
```

### resendInvitation again inside the minute: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamResend($id: String!) { resendInvitation(memberId: $id) { id status } }",
  "variables": {
    "id": "<MEMBER_GQL_PENDING>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The invitation was just sent. Wait a minute before sending it again.",
      "locations": [
        {
          "line": 1,
          "column": 37
        }
      ],
      "path": [
        "resendInvitation"
      ],
      "extensions": {
        "code": "team.resend-cooldown"
      }
    }
  ],
  "data": null
}
```

### revokeInvitation (TeamRevoke)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation TeamRevoke($id: String!) { revokeInvitation(memberId: $id) }",
  "variables": {
    "id": "<MEMBER_GQL_PENDING>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "revokeInvitation": true
  }
}
```

