# Isolation: invitation

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### invitation.list-pending (A attacks B)

A's owner calls teamMembers: A's own rows only. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { teamMembers(input: { tab: pending }) { total counts { all pending } items { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "teamMembers": {
      "total": 1,
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
        }
      ]
    }
  }
}
```

### invitation.by-id (A attacks B)

A's owner calls teamMember on B's pending invitation: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($id: String!) { teamMember(id: $id) { id administratorId email name status storeIds storeNames commissionConfigIds baseSalary } }

variables: {
  "id": "<TEAM_MEMBER_B_INVITED>"
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

### invitation.by-id-rest (A attacks B)

A's owner calls GET /employees/:id on B's pending invitation: 404 team.member-not-found. **Pass.**

```http
GET /employees/<TEAM_MEMBER_B_INVITED>
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_INVITED>"
}
```

### invitation.resend (A attacks B)

A's owner calls resendInvitation on B's pending invitation: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { resendInvitation(memberId: $id) { id email } }

variables: {
  "id": "<TEAM_MEMBER_B_INVITED>"
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
        "resendInvitation"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### invitation.resend (B attacks A)

Reverse run: B's owner plays A's part and A is the victim. A's owner calls resendInvitation on B's pending invitation: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { resendInvitation(memberId: $id) { id email } }

variables: {
  "id": "<TEAM_MEMBER_A_INVITED>"
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
        "resendInvitation"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### invitation.resend-rest (A attacks B)

A's owner calls POST /employees/resend-invitation on B's pending invitation: 404 team.member-not-found. **Pass.**

```http
POST /employees/resend-invitation
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


{
  "memberId": "<TEAM_MEMBER_B_INVITED>"
}
```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/resend-invitation"
}
```

### invitation.revoke (A attacks B)

A's owner calls revokeInvitation on B's pending invitation: team.member-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($id: String!) { revokeInvitation(memberId: $id) }

variables: {
  "id": "<TEAM_MEMBER_B_INVITED>"
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
        "revokeInvitation"
      ],
      "extensions": {
        "code": "team.member-not-found"
      }
    }
  ],
  "data": null
}
```

### invitation.revoke-rest (A attacks B)

A's owner calls POST /employees/:id/revoke-invitation on B's pending invitation: 404 team.member-not-found. **Pass.**

```http
POST /employees/<TEAM_MEMBER_B_INVITED>/revoke-invitation
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>

```

**HTTP 404**

```json
{
  "statusCode": 404,
  "code": "team.member-not-found",
  "message": "Team member not found.",
  "path": "/employees/<TEAM_MEMBER_B_INVITED>/revoke-invitation"
}
```

### invitation.invite-with-victim-role (A attacks B)

A's owner invites with B's business role: rbac.role-not-found. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id email } }

variables: {
  "input": {
    "email": "isolation-invite-<BUSINESS_A>@example.test",
    "roleIds": [
      "<ROLE_B>"
    ],
    "storeAccess": "selected",
    "storeIds": [
      "<STORE_A1>"
    ],
    "baseSalary": 1
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "Role not found.",
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
        "code": "rbac.role-not-found"
      }
    }
  ],
  "data": null
}
```

### invitation.preview-guessed-token (A attacks B)

A link holder previews with B's invited member id as the token: 400 team.invitation-invalid, nothing of B. **Pass.**

```http
GET /team/invitations/preview?token=<TEAM_MEMBER_B_INVITED>

```

**HTTP 400**

```json
{
  "statusCode": 400,
  "code": "team.invitation-invalid",
  "message": "This invitation link cannot be used. Ask for a new invitation.",
  "path": "/team/invitations/preview"
}
```

### invitation.accept-guessed-token (A attacks B)

A link holder accepts with B's invited member id as the token: 400 team.invitation-invalid, no account. **Pass.**

```http
POST /team/invitations/accept


{
  "token": "<TEAM_MEMBER_B_INVITED>",
  "firstName": "Guess",
  "lastName": "Work",
  "password": "isolation-password-1"
}
```

**HTTP 400**

```json
{
  "statusCode": 400,
  "code": "team.invitation-invalid",
  "message": "This invitation link cannot be used. Ask for a new invitation.",
  "path": "/team/invitations/accept"
}
```

### invitation.victim-channel-revoke (A attacks B)

A's owner calls revokeInvitation with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($id: String!) { revokeInvitation(memberId: $id) }

variables: {
  "id": "<TEAM_MEMBER_B_INVITED>"
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
        "revokeInvitation"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
