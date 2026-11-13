# Isolation: salary payment

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### salary.pay (A attacks B)

A's owner calls payTeamMember on B's owner member row: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { payTeamMember(id: $id, idempotencyKey: "isolation-pay") { id amount } }

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
        "payTeamMember"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### salary.pay-rest (A attacks B)

A's owner calls POST /employees/:id/pay on B's owner member row: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_OWNER>/pay
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "idempotencyKey": "isolation-pay"
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_OWNER>/pay"
}
```

### salary.victim-channel-pay (A attacks B)

A's owner calls payTeamMember with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { payTeamMember(id: $id, idempotencyKey: "isolation-pay") { id amount } }

variables: {
  "id": "<TEAM_MEMBER_B_OWNER>"
}
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
          "column": 27
        }
      ],
      "path": [
        "payTeamMember"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
