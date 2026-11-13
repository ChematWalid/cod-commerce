# Isolation: activity log

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### activity.list (A attacks B)

A's owner reads the role activity: A's rows only, with A's role. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary actor { id name } storeId } nextCursor } }

variables: {
  "input": {
    "first": 100,
    "entityType": "role"
  }
}
```

**HTTP 200**

```json
{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "246894956453564416",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_A>",
          "summary": "Role Role A b8b7305f created",
          "actor": {
            "id": "<ADMIN_A_OWNER>",
            "name": "OwnerA PrivateAb8b7305f"
          },
          "storeId": null
        }
      ],
      "nextCursor": null
    }
  }
}
```

### activity.victim-entity (A attacks B)

A's owner filters the activity log by B's role: no rows. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary actor { id name } storeId } nextCursor } }

variables: {
  "input": {
    "entityType": "role",
    "entityId": "<ROLE_B>"
  }
}
```

**HTTP 200**

```json
{
  "data": {
    "activityLog": {
      "items": [],
      "nextCursor": null
    }
  }
}
```

### activity.victim-actor (A attacks B)

A's owner filters the activity log by B's owner as actor: no rows. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary actor { id name } storeId } nextCursor } }

variables: {
  "input": {
    "actorAdministratorId": "<ADMIN_B_OWNER>"
  }
}
```

**HTTP 200**

```json
{
  "data": {
    "activityLog": {
      "items": [],
      "nextCursor": null
    }
  }
}
```

### activity.victim-channel (A attacks B)

A's owner reads the activity log with B's store token: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary actor { id name } storeId } nextCursor } }

variables: {
  "input": {
    "first": 100
  }
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
          "column": 36
        }
      ],
      "path": [
        "activityLog"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
