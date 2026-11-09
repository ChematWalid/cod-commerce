# Activity log

Newest first, with a cursor. A limited member with settings.activity-log.view sees the rows of the stores they can reach.

### activityLog, first page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "first": 5
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
          "id": "245577443337834496",
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
              "roleIds": [
                "<ROLE_VIEWER>",
                "<ROLE_CLERK>"
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
          "createdAt": "2026-11-09T15:57:05.100Z"
        },
        {
          "id": "245577440913526784",
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
          "createdAt": "2026-11-09T15:57:04.522Z"
        },
        {
          "id": "245577438665379840",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role deleted",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.986Z"
        },
        {
          "id": "245577438157869056",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) deleted",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [],
              "removed": [
                "finance.expenses.view",
                "finance.records.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.865Z"
        },
        {
          "id": "<ACTIVITY_CURSOR>",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_REST_COPY>",
          "summary": "Role Evidence rest role (copy) created",
          "diff": {
            "name": "Evidence rest role (copy)",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.734Z"
        }
      ],
      "nextCursor": "<ACTIVITY_CURSOR>"
    }
  }
}
```

### activityLog, next page

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "first": 5,
      "after": "<ACTIVITY_CURSOR>"
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
          "id": "245577437272870912",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role updated",
          "diff": {
            "name": {
              "after": "Evidence rest role",
              "before": "Evidence rest role"
            },
            "description": {
              "after": "Changed through REST",
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.654Z"
        },
        {
          "id": "245577436807303168",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_REST>",
          "summary": "Role Evidence rest role created",
          "diff": {
            "name": "Evidence rest role",
            "permissions": {
              "added": [
                "finance.expenses.view",
                "finance.records.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.543Z"
        },
        {
          "id": "245577436454981632",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role renamed deleted",
          "diff": {
            "name": "Evidence role renamed",
            "permissions": {
              "added": [],
              "removed": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:03.459Z"
        },
        {
          "id": "245577434177474560",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "<ROLE_COPY>",
          "summary": "Role Evidence role renamed (copy) deleted",
          "diff": {
            "name": "Evidence role renamed (copy)",
            "permissions": {
              "added": [],
              "removed": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:02.916Z"
        },
        {
          "id": "245577431971270656",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "<ROLE_COPY>",
          "summary": "Role Evidence role renamed (copy) created",
          "diff": {
            "name": "Evidence role renamed (copy)",
            "permissions": {
              "added": [
                "orders.customers.view",
                "orders.returns.view",
                "orders.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-09T15:57:02.390Z"
        }
      ],
      "nextCursor": "245577431971270656"
    }
  }
}
```

### activityLog without the permission: FORBIDDEN

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

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

