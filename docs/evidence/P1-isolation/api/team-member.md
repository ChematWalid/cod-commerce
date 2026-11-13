# Isolation: team member

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### team-member.list (A attacks B)

A's owner calls teamMembers: A's own rows only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { teamMembers(input: { tab: all }) { total counts { all pending } items { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "teamMembers": {
      "total": 2,
      "counts": {
        "all": 2,
        "pending": 1
      },
      "items": [
        {
          "id": "<TEAM_MEMBER_A_INVITED>",
          "administratorId": null,
          "email": "invitee-a-<BUSINESS_A>@example.test",
          "name": null,
          "status": "invited",
          "storeIds": [
            "<STORE_A1>"
          ],
          "storeNames": [
            "Store A1 ee06632b"
          ],
          "commissionConfigIds": [
            "<COMMISSION_A>"
          ],
          "baseSalary": 25000
        },
        {
          "id": "<TEAM_MEMBER_A_OWNER>",
          "administratorId": "<ADMIN_A_OWNER>",
          "email": "owner-a-ee06632b@example.test",
          "name": "OwnerA Seed",
          "status": "active",
          "storeIds": [],
          "storeNames": [],
          "commissionConfigIds": [],
          "baseSalary": 0
        }
      ]
    }
  }
}
```

### team-member.list (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner calls teamMembers: A's own rows only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { teamMembers(input: { tab: all }) { total counts { all pending } items { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "teamMembers": {
      "total": 2,
      "counts": {
        "all": 2,
        "pending": 1
      },
      "items": [
        {
          "id": "<TEAM_MEMBER_B_INVITED>",
          "administratorId": null,
          "email": "invitee-b-<BUSINESS_B>@example.test",
          "name": null,
          "status": "invited",
          "storeIds": [
            "<STORE_B1>"
          ],
          "storeNames": [
            "Store B1 ee06632b"
          ],
          "commissionConfigIds": [
            "<COMMISSION_B>"
          ],
          "baseSalary": 25000
        },
        {
          "id": "<TEAM_MEMBER_B_OWNER>",
          "administratorId": "<ADMIN_B_OWNER>",
          "email": "owner-b-ee06632b@example.test",
          "name": "OwnerB Seed",
          "status": "active",
          "storeIds": [],
          "storeNames": [],
          "commissionConfigIds": [],
          "baseSalary": 0
        }
      ]
    }
  }
}
```

### team-member.list-rest (A attacks B)

A's owner calls GET /employees: A's own rows only. **Pass.**

```http
GET /employees?tab=all
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 200**

```json
{
  "items": [
    {
      "id": "<TEAM_MEMBER_A_INVITED>",
      "administratorId": null,
      "email": "invitee-a-<BUSINESS_A>@example.test",
      "firstName": null,
      "lastName": null,
      "status": "invited",
      "commissionConfigIds": [
        "<COMMISSION_A>"
      ],
      "baseSalary": 25000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-13T14:27:09.575Z",
      "joinedAt": null,
      "tab": "pending",
      "invitationExpired": false,
      "name": null,
      "roles": [
        {
          "id": "<ROLE_A>",
          "name": "Role A ee06632b"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_A1>"
      ],
      "storeNames": [
        "Store A1 ee06632b"
      ],
      "ordersCount": 0
    },
    {
      "id": "<TEAM_MEMBER_A_OWNER>",
      "administratorId": "<ADMIN_A_OWNER>",
      "email": "owner-a-ee06632b@example.test",
      "firstName": "OwnerA",
      "lastName": "Seed",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-13T14:27:02.806Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "OwnerA Seed",
      "roles": [
        {
          "id": "247004335538442240",
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
    "all": 2,
    "active": 1,
    "pending": 1,
    "inactive": 0
  },
  "total": 2
}
```

### order-manager.list (A attacks B)

A's owner calls teamOrderManagers: A's own rows only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { teamOrderManagers { id name maxOpenOrders storeAccess storeIds } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "teamOrderManagers": [
      {
        "id": "<TEAM_MEMBER_A_OWNER>",
        "name": "OwnerA Seed",
        "maxOpenOrders": null,
        "storeAccess": "all",
        "storeIds": []
      }
    ]
  }
}
```

### order-manager.list-rest (A attacks B)

A's owner calls GET /employees/order-managers: A's own rows only. **Pass.**

```http
GET /employees/order-managers
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 200**

```json
[
  {
    "id": "<TEAM_MEMBER_A_OWNER>",
    "name": "OwnerA Seed",
    "maxOpenOrders": null,
    "storeAccess": "all",
    "storeIds": []
  }
]
```

### team-member.by-id (A attacks B)

A's owner calls teamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { teamMember(id: $id) { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
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

### team-member.by-id (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner calls teamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query ($id: String!) { teamMember(id: $id) { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } }

variables: {
  "id": "<TEAM_MEMBER_A_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 24
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

### team-member.by-id-rest (A attacks B)

A's owner calls GET /employees/:id on B's owner member row: 404 team.member-not-found. **Pass.**

```http
GET /employees/<TEAM_MEMBER_B_OWNER>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>"
}
```

### team-member.update (A attacks B)

A's owner calls updateTeamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>",
  "input": {
    "baseSalary": 1
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
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
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### team-member.update-rest (A attacks B)

A's owner calls PATCH /employees/:id on B's owner member row: 404 team.member-not-found. **Pass.**

```http
PATCH /employees/<TEAM_MEMBER_B_OWNER>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "baseSalary": 1
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>"
}
```

### team-member.limit (A attacks B)

A's owner calls setTeamMemberLimit on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { setTeamMemberLimit(id: $id, maxOpenOrders: 5) { id } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "setTeamMemberLimit"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### team-member.limit-rest (A attacks B)

A's owner calls POST /employees/:id/limit on B's owner member row: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_OWNER>/limit
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "maxOpenOrders": 5
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>/limit"
}
```

### order-manager.receiving (A attacks B)

A's owner calls setTeamMemberReceiving on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { setTeamMemberReceiving(id: $id, receivingOrders: false) { id } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "setTeamMemberReceiving"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### order-manager.receiving-rest (A attacks B)

A's owner calls POST /employees/:id/receiving on B's owner member row: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_OWNER>/receiving
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "receivingOrders": false
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>/receiving"
}
```

### team-member.deactivate (A attacks B)

A's owner calls deactivateTeamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { deactivateTeamMember(id: $id) { id } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "deactivateTeamMember"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### team-member.deactivate-rest (A attacks B)

A's owner calls POST /employees/:id/deactivate on B's owner member row: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_OWNER>/deactivate
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>/deactivate"
}
```

### team-member.reactivate (A attacks B)

A's owner calls reactivateTeamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { reactivateTeamMember(id: $id) { id } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "reactivateTeamMember"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### team-member.reactivate-rest (A attacks B)

A's owner calls POST /employees/:id/reactivate on B's owner member row: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_OWNER>/reactivate
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>/reactivate"
}
```

### team-member.remove (A attacks B)

A's owner calls removeTeamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { removeTeamMember(id: $id) }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Team member not found.",
      "locations": [
        {
          "line": 1,
          "column": 27
        }
      ],
      "path": [
        "removeTeamMember"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### team-member.remove-rest (A attacks B)

A's owner calls DELETE /employees/:id on B's owner member row: 404 team.member-not-found. **Pass.**

```http
DELETE /employees/<TEAM_MEMBER_B_OWNER>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>"
}
```

### team-member.victim-channel (A attacks B)

A's owner calls teamMembers with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { teamMembers(input: { tab: all }) { total counts { all pending } items { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } } }

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
        "teamMembers"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### team-member.victim-channel-rest (A attacks B)

A's owner calls GET /employees with B's store token: 403. **Pass.**

```http
GET /employees
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 403**

```json
{
  "statusCode": 403,
  "message": "FORBIDDEN: error.forbidden",
  "timestamp": "2026-11-13T14:27:23.859Z",
  "path": "/employees"
}
```

### order-manager.victim-channel (A attacks B)

A's owner calls teamOrderManagers with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { teamOrderManagers { id name maxOpenOrders storeAccess storeIds } }

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
        "teamOrderManagers"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
