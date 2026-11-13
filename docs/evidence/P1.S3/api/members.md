# Member access

One role set and one store access per member. Administrator ids are the engine's small integers and are shown as they are.

### memberAccess

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($administratorId: String!) { memberAccess(administratorId: $administratorId) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "administratorId": "4"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "memberAccess": {
      "administratorId": "4",
      "roles": [
        {
          "id": "<ROLE_VIEWER>",
          "name": "Demo viewer"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ]
    }
  }
}
```

### setMemberAccess: a second role

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }",
  "variables": {
    "input": {
      "administratorId": "4",
      "roleIds": [
        "<ROLE_VIEWER>",
        "<ROLE_CLERK>"
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ]
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "setMemberAccess": {
      "administratorId": "4",
      "roles": [
        {
          "id": "<ROLE_VIEWER>",
          "name": "Demo viewer"
        },
        {
          "id": "<ROLE_CLERK>",
          "name": "Demo orders clerk"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ]
    }
  }
}
```

### activityLog: the row of that change

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "entityId": "4"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "247026666121990144",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:46.737Z"
        },
        {
          "id": "247026523066867712",
          "action": "rbac.member-access.changed",
          "entityType": "member",
          "entityId": "4",
          "summary": "Member access changed",
          "diff": {
            "after": {
              "roleIds": [
                "<ROLE_VIEWER>"
              ],
              "storeIds": [
                "<STORE_DEMO>"
              ],
              "storeAccess": "selected"
            },
            "before": {
              "roleIds": [],
              "storeIds": [],
              "storeAccess": null
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:12.630Z"
        }
      ],
      "nextCursor": null
    }
  }
}
```

