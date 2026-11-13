# Isolation: commission

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### commission.list (A attacks B)

A's owner calls teamCommissionConfigs: A's own rows only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { teamCommissionConfigs { id name basis valueKind value scope storeIds } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "teamCommissionConfigs": [
      {
        "id": "<COMMISSION_A>",
        "name": "Commission A <BUSINESS_A>",
        "basis": "per-confirmed-order",
        "valueKind": "fixed",
        "value": 150,
        "scope": "all",
        "storeIds": []
      }
    ]
  }
}
```

### commission.list-rest (A attacks B)

A's owner calls GET /commissions/configs: A's own rows only. **Pass.**

```http
GET /commissions/configs
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 200**

```json
[
  {
    "id": "<COMMISSION_A>",
    "name": "Commission A <BUSINESS_A>",
    "basis": "per-confirmed-order",
    "valueKind": "fixed",
    "value": 150,
    "scope": "all",
    "storeIds": [],
    "createdAt": "2026-11-13T14:27:09.519Z",
    "updatedAt": "2026-11-13T14:27:09.519Z"
  }
]
```

### commission.by-id (A attacks B)

A's owner calls teamCommissionConfig on B's commission config: team.commission-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { teamCommissionConfig(id: $id) { id name basis valueKind value scope storeIds } }

variables: {
  "id": "<COMMISSION_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Commission not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
        }
      ],
      "path": [
        "teamCommissionConfig"
      ],
      "extensions": {
        "code": "team.commission-not-found"
      }
    }
  ],
  "data": null
}
```

### commission.by-id-rest (A attacks B)

A's owner calls GET /commissions/configs/:id on B's commission config: 404 team.commission-not-found. **Pass.**

```http
GET /commissions/configs/<COMMISSION_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.commission-not-found",
  "message": "Commission not found.",
  "path": "/commissions/configs/<COMMISSION_B>"
}
```

### commission.update (A attacks B)

A's owner calls updateTeamCommissionConfig on B's commission config: team.commission-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateTeamCommissionConfigInput!) {
  updateTeamCommissionConfig(id: $id, input: $input) { id }
}

variables: {
  "id": "<COMMISSION_B>",
  "input": {
    "value": 2
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Commission not found.",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": [
        "updateTeamCommissionConfig"
      ],
      "extensions": {
        "code": "team.commission-not-found"
      }
    }
  ],
  "data": null
}
```

### commission.update-rest (A attacks B)

A's owner calls PATCH /commissions/configs/:id on B's commission config: 404 team.commission-not-found. **Pass.**

```http
PATCH /commissions/configs/<COMMISSION_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "value": 2
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.commission-not-found",
  "message": "Commission not found.",
  "path": "/commissions/configs/<COMMISSION_B>"
}
```

### commission.delete (A attacks B)

A's owner calls deleteTeamCommissionConfig on B's commission config: team.commission-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { deleteTeamCommissionConfig(id: $id) }

variables: {
  "id": "<COMMISSION_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Commission not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deleteTeamCommissionConfig"
      ],
      "extensions": {
        "code": "team.commission-not-found"
      }
    }
  ],
  "data": null
}
```

### commission.delete-rest (A attacks B)

A's owner calls DELETE /commissions/configs/:id on B's commission config: 404 team.commission-not-found. **Pass.**

```http
DELETE /commissions/configs/<COMMISSION_B>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.commission-not-found",
  "message": "Commission not found.",
  "path": "/commissions/configs/<COMMISSION_B>"
}
```

### invitation.invite-with-victim-commission (A attacks B)

A's owner invites with B's commission config: team.commission-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id email } }

variables: {
  "input": {
    "email": "isolation-invite-<BUSINESS_A>@example.test",
    "roleIds": [
      "<ROLE_A>"
    ],
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_A1>"
    ],
    "baseSalary": 1,
    "commissionConfigIds": [
      "<COMMISSION_B>"
    ]
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Commission not found.",
      "locations": [
        {
          "line": 1,
          "column": 41
        }
      ],
      "path": [
        "inviteMember"
      ],
      "extensions": {
        "code": "team.commission-not-found"
      }
    }
  ],
  "data": null
}
```

### invitation.invite-with-victim-commission-rest (A attacks B)

A's owner invites with B's commission config over REST: 404 team.commission-not-found. **Pass.**

```http
POST /employees
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "email": "isolation-invite-<BUSINESS_A>@example.test",
  "roleIds": [
    "<ROLE_A>"
  ],
  "storeAccess": "selected",
  "storeIds": [
    "<STORE_A1>"
  ],
  "baseSalary": 1,
  "commissionConfigIds": [
    "<COMMISSION_B>"
  ]
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.commission-not-found",
  "message": "Commission not found.",
  "path": "/employees"
}
```

### team-member.give-victim-commission (A attacks B)

A's owner gives A's invitee B's commission config: team.commission-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id } }

variables: {
  "id": "<TEAM_MEMBER_A_INVITED>",
  "input": {
    "commissionConfigIds": [
      "<COMMISSION_B>"
    ]
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Commission not found.",
      "locations": [
        {
          "line": 1,
          "column": 59
        }
      ],
      "path": [
        "updateTeamMember"
      ],
      "extensions": {
        "code": "team.commission-not-found"
      }
    }
  ],
  "data": null
}
```

### commission.create-on-victim-store (A attacks B)

A's owner scopes a new commission config to B's store: team.invalid-input. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: TeamCommissionConfigInput!) { createTeamCommissionConfig(input: $input) { id } }

variables: {
  "input": {
    "name": "On B <BUSINESS_A>",
    "basis": "per-confirmed-order",
    "valueKind": "fixed",
    "value": 1,
    "scope": "selected",
    "storeIds": [
      "<STORE_B1>"
    ]
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Some of the details are not valid.",
      "locations": [
        {
          "line": 1,
          "column": 49
        }
      ],
      "path": [
        "createTeamCommissionConfig"
      ],
      "extensions": {
        "code": "team.invalid-input"
      }
    }
  ],
  "data": null
}
```

### commission.victim-channel (A attacks B)

A's owner calls teamCommissionConfigs with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { teamCommissionConfigs { id name basis valueKind value scope storeIds } }

variables: {}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 9
        }
      ],
      "path": [
        "teamCommissionConfigs"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### commission.victim-channel-rest (A attacks B)

A's owner calls GET /commissions/configs with B's store token: 403. **Pass.**

```http
GET /commissions/configs
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 403**

```json
{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T14:27:23.884Z",
  "path": "/commissions/configs"
}
```
