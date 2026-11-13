# Activity log

Newest first, with a cursor. A limited member with settings.activity-log.view sees the rows of the stores they can reach. No feature on main records a store-scoped row yet (the RBAC rows are business-wide), so the two store rows below are seeded straight into Postgres, one per Demo store; every read goes through the live API.

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
          "id": "247026669070585856",
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
          "createdAt": "2026-11-13T15:55:47.440Z"
        },
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
          "id": "247026663982895104",
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
          "createdAt": "2026-11-13T15:55:46.227Z"
        },
        {
          "id": "247026663643156480",
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
          "createdAt": "2026-11-13T15:55:46.146Z"
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
          "createdAt": "2026-11-13T15:55:46.024Z"
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
          "id": "247026662812684288",
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
          "createdAt": "2026-11-13T15:55:45.948Z"
        },
        {
          "id": "247026662321950720",
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
          "createdAt": "2026-11-13T15:55:45.831Z"
        },
        {
          "id": "247026661978017792",
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
          "createdAt": "2026-11-13T15:55:45.749Z"
        },
        {
          "id": "247026659583070208",
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
          "createdAt": "2026-11-13T15:55:45.179Z"
        },
        {
          "id": "247026657158762496",
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
          "createdAt": "2026-11-13T15:55:44.600Z"
        }
      ],
      "nextCursor": "247026657158762496"
    }
  }
}
```

### activityLog, the owner (all stores) after one synthetic row was seeded on each Demo store

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }",
  "variables": {
    "input": {
      "first": 3
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
          "id": "<ACTIVITY_ROW_DEMO2>",
          "action": "evidence.store-scoped",
          "entityType": "store",
          "entityId": "<STORE_DEMO2>",
          "summary": "Synthetic store-scoped row (evidence seed)",
          "diff": {},
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": "<STORE_DEMO2>",
          "createdAt": "2026-11-13T16:06:36.818Z"
        },
        {
          "id": "<ACTIVITY_ROW_DEMO>",
          "action": "evidence.store-scoped",
          "entityType": "store",
          "entityId": "<STORE_DEMO>",
          "summary": "Synthetic store-scoped row (evidence seed)",
          "diff": {},
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": "<STORE_DEMO>",
          "createdAt": "2026-11-13T16:06:36.661Z"
        },
        {
          "id": "247029319505809408",
          "action": "team.invitation.accepted",
          "entityType": "team-member",
          "entityId": "247029313000443904",
          "summary": "Invitation accepted",
          "diff": {
            "memberId": "247029313000443904",
            "displayName": "Samir Haddad",
            "changedFields": [
              "status"
            ]
          },
          "actor": {
            "id": "14",
            "name": "Samir Haddad"
          },
          "storeId": null,
          "createdAt": "2026-11-13T16:06:19.353Z"
        }
      ],
      "nextCursor": "247029319505809408"
    }
  }
}
```

### activityLog, a limited member on one selected store: the Demo row and business-wide rows; the Demo2 row is filtered out

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
  "data": {
    "activityLog": {
      "items": [
        {
          "id": "<ACTIVITY_ROW_DEMO>",
          "action": "evidence.store-scoped",
          "entityType": "store",
          "entityId": "<STORE_DEMO>",
          "summary": "Synthetic store-scoped row (evidence seed)",
          "diff": {},
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": "<STORE_DEMO>",
          "createdAt": "2026-11-13T16:06:36.661Z"
        },
        {
          "id": "247029156246720512",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "247029146398494720",
          "summary": "Role Browser role 1794585937277 deleted",
          "diff": {
            "name": "Browser role 1794585937277",
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
          "createdAt": "2026-11-13T16:05:40.429Z"
        },
        {
          "id": "247029152329240576",
          "action": "rbac.role.deleted",
          "entityType": "role",
          "entityId": "247029148873134080",
          "summary": "Role Browser role 1794585937277 (copy) deleted",
          "diff": {
            "name": "Browser role 1794585937277 (copy)",
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
          "createdAt": "2026-11-13T16:05:39.495Z"
        },
        {
          "id": "247029148877328384",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "247029148873134080",
          "summary": "Role Browser role 1794585937277 (copy) created",
          "diff": {
            "name": "Browser role 1794585937277 (copy)",
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
          "createdAt": "2026-11-13T16:05:38.672Z"
        },
        {
          "id": "247029146402689024",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247029146398494720",
          "summary": "Role Browser role 1794585937277 created",
          "diff": {
            "name": "Browser role 1794585937277",
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
          "createdAt": "2026-11-13T16:05:38.082Z"
        },
        {
          "id": "247027219229052928",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:57:58.608Z"
        },
        {
          "id": "247027215353516032",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:57:57.684Z"
        },
        {
          "id": "247027122101555200",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:57:35.451Z"
        },
        {
          "id": "247027118368624640",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:57:34.561Z"
        },
        {
          "id": "247027015494930432",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "247027015486541824",
          "summary": "Role Evidence en mobile 1794585222 (copy) created",
          "diff": {
            "name": "Evidence en mobile 1794585222 (copy)",
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
          "createdAt": "2026-11-13T15:57:10.034Z"
        },
        {
          "id": "247027014312136704",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247027014307942400",
          "summary": "Role Evidence en mobile 1794585222 created",
          "diff": {
            "name": "Evidence en mobile 1794585222",
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
          "createdAt": "2026-11-13T15:57:09.752Z"
        },
        {
          "id": "247026990954057728",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "247026990949863424",
          "summary": "Role Evidence en desktop 1794585222 (copy) created",
          "diff": {
            "name": "Evidence en desktop 1794585222 (copy)",
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
          "createdAt": "2026-11-13T15:57:04.183Z"
        },
        {
          "id": "247026990148751360",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026990144557056",
          "summary": "Role Evidence en desktop 1794585222 created",
          "diff": {
            "name": "Evidence en desktop 1794585222",
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
          "createdAt": "2026-11-13T15:57:03.991Z"
        },
        {
          "id": "247026967113633792",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:56:58.499Z"
        },
        {
          "id": "247026962587979776",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:56:57.420Z"
        },
        {
          "id": "247026865896689664",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:56:34.367Z"
        },
        {
          "id": "247026861727551488",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:56:33.373Z"
        },
        {
          "id": "247026754386923520",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "247026754378534912",
          "summary": "Role Evidence ar mobile 1794585222 (نسخة) created",
          "diff": {
            "name": "Evidence ar mobile 1794585222 (نسخة)",
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
          "createdAt": "2026-11-13T15:56:07.781Z"
        },
        {
          "id": "247026753380290560",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026753376096256",
          "summary": "Role Evidence ar mobile 1794585222 created",
          "diff": {
            "name": "Evidence ar mobile 1794585222",
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
          "createdAt": "2026-11-13T15:56:07.541Z"
        },
        {
          "id": "247026729686667264",
          "action": "rbac.role.duplicated",
          "entityType": "role",
          "entityId": "247026729682472960",
          "summary": "Role Evidence ar desktop 1794585222 (نسخة) created",
          "diff": {
            "name": "Evidence ar desktop 1794585222 (نسخة)",
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
          "createdAt": "2026-11-13T15:56:01.892Z"
        },
        {
          "id": "247026728361267201",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026728361267200",
          "summary": "Role Evidence ar desktop 1794585222 created",
          "diff": {
            "name": "Evidence ar desktop 1794585222",
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
          "createdAt": "2026-11-13T15:56:01.576Z"
        },
        {
          "id": "247026693762453504",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:53.327Z"
        },
        {
          "id": "247026691854045184",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.view"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:52.872Z"
        },
        {
          "id": "247026681011769344",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "team.roles.create"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:50.287Z"
        },
        {
          "id": "247026679237578752",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer updated",
          "diff": {
            "name": {
              "after": "Demo viewer",
              "before": "Demo viewer"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [
                "team.roles.create"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:49.864Z"
        },
        {
          "id": "247026663982895104",
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
          "createdAt": "2026-11-13T15:55:46.227Z"
        },
        {
          "id": "247026663643156480",
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
          "createdAt": "2026-11-13T15:55:46.146Z"
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
          "createdAt": "2026-11-13T15:55:46.024Z"
        },
        {
          "id": "247026662812684288",
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
          "createdAt": "2026-11-13T15:55:45.948Z"
        },
        {
          "id": "247026662321950720",
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
          "createdAt": "2026-11-13T15:55:45.831Z"
        },
        {
          "id": "247026661978017792",
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
          "createdAt": "2026-11-13T15:55:45.749Z"
        },
        {
          "id": "247026659583070208",
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
          "createdAt": "2026-11-13T15:55:45.179Z"
        },
        {
          "id": "247026657158762496",
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
          "createdAt": "2026-11-13T15:55:44.600Z"
        },
        {
          "id": "247026654973530112",
          "action": "rbac.role.updated",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role renamed updated",
          "diff": {
            "name": {
              "after": "Evidence role renamed",
              "before": "Evidence role"
            },
            "description": {
              "after": null,
              "before": null
            },
            "permissions": {
              "added": [],
              "removed": [
                "orders.cancel"
              ]
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:44.079Z"
        },
        {
          "id": "247026652284981248",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_CREATED>",
          "summary": "Role Evidence role created",
          "diff": {
            "name": "Evidence role",
            "permissions": {
              "added": [
                "orders.cancel",
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
          "createdAt": "2026-11-13T15:55:43.438Z"
        },
        {
          "id": "247026527189868544",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026527185674240",
          "summary": "Role Demo first store catalog created",
          "diff": {
            "name": "Demo first store catalog",
            "permissions": {
              "added": [
                "catalog.products.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:13.613Z"
        },
        {
          "id": "247026525805748224",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026525801553920",
          "summary": "Role Demo settings viewer created",
          "diff": {
            "name": "Demo settings viewer",
            "permissions": {
              "added": [
                "settings.business.view",
                "store.stores.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:13.283Z"
        },
        {
          "id": "247026524450988033",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "247026524450988032",
          "summary": "Role Demo no view created",
          "diff": {
            "name": "Demo no view",
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
          "createdAt": "2026-11-13T15:55:12.960Z"
        },
        {
          "id": "247026523167531008",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_CLERK>",
          "summary": "Role Demo orders clerk created",
          "diff": {
            "name": "Demo orders clerk",
            "permissions": {
              "added": [
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
          "createdAt": "2026-11-13T15:55:12.654Z"
        },
        {
          "id": "247026521858908160",
          "action": "rbac.role.created",
          "entityType": "role",
          "entityId": "<ROLE_VIEWER>",
          "summary": "Role Demo viewer created",
          "diff": {
            "name": "Demo viewer",
            "permissions": {
              "added": [
                "settings.activity-log.view",
                "team.roles.view"
              ],
              "removed": []
            }
          },
          "actor": {
            "id": "2",
            "name": "Demo Owner"
          },
          "storeId": null,
          "createdAt": "2026-11-13T15:55:12.342Z"
        }
      ],
      "nextCursor": null
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

