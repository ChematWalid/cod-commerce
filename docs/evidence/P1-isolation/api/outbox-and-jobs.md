# Isolation: outbox and jobs

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### jobs.health (A attacks B)

A's owner reads the platform-wide outbox and jobs health: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }

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
        "platformJobsHealth"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### jobs.health (B attacks A)

A's owner reads the platform-wide outbox and jobs health: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_B1>


query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }

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
        "platformJobsHealth"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
