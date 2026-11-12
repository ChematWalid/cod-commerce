# Members list and one member

Tabs All, Active, Pending and Inactive with their counts, search, one member's details, and the GraphQL query. The seeded members came in through the converge (D215).

### GET /employees?tab=all

```http
GET http://127.0.0.1:23100/employees?tab=all
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_SECOND_STORE_ONLY>",
      "administratorId": null,
      "email": "second-store@invitee.example.test",
      "firstName": null,
      "lastName": null,
      "status": "invited",
      "commissionConfigIds": [],
      "baseSalary": 20000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.953Z",
      "joinedAt": null,
      "tab": "pending",
      "invitationExpired": false,
      "name": null,
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO2>"
      ],
      "storeNames": [
        "Demo Store 2"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_PENDING>",
      "administratorId": null,
      "email": "pending@invitee.example.test",
      "firstName": null,
      "lastName": null,
      "status": "invited",
      "commissionConfigIds": [],
      "baseSalary": 20000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.689Z",
      "joinedAt": null,
      "tab": "pending",
      "invitationExpired": false,
      "name": null,
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_KARIM>",
      "administratorId": "10",
      "email": "karim@invitee.example.test",
      "firstName": "Karim",
      "lastName": "Haddad",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 25000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.203Z",
      "joinedAt": "2026-11-12T18:32:59.957Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Karim Haddad",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_AMINA>",
      "administratorId": "9",
      "email": "amina@invitee.example.test",
      "firstName": "Amina",
      "lastName": "Saadi",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 30000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:56.494Z",
      "joinedAt": "2026-11-12T18:32:58.769Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Amina Saadi",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704177123328",
      "administratorId": "8",
      "email": "perstore@demo.example.test",
      "firstName": "PerStore",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.609Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "PerStore Member",
      "roles": [
        {
          "id": "246703702025445376",
          "name": "Demo first store catalog"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "246703704160346112",
      "administratorId": "7",
      "email": "settingsview@demo.example.test",
      "firstName": "SettingsView",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.605Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "SettingsView Member",
      "roles": [
        {
          "id": "246703700616159232",
          "name": "Demo settings viewer"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704147763200",
      "administratorId": "6",
      "email": "noview@demo.example.test",
      "firstName": "NoView",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.602Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "NoView Member",
      "roles": [
        {
          "id": "246703699307536384",
          "name": "Demo no view"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704130985984",
      "administratorId": "5",
      "email": "orders@demo.example.test",
      "firstName": "Orders",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.598Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Orders Member",
      "roles": [
        {
          "id": "246703697931804672",
          "name": "Demo orders clerk"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704118403072",
      "administratorId": "4",
      "email": "limited@demo.example.test",
      "firstName": "Limited",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.595Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Limited Member",
      "roles": [
        {
          "id": "<ROLE_DEMO_VIEWER>",
          "name": "Demo viewer"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_OWNER>",
      "administratorId": "2",
      "email": "owner@demo.example.test",
      "firstName": "Demo",
      "lastName": "Owner",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:23.731Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Demo Owner",
      "roles": [
        {
          "id": "246703691921367040",
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
    "all": 10,
    "active": 8,
    "pending": 2,
    "inactive": 0
  },
  "total": 10
}
```

### GET /employees?tab=active

```http
GET http://127.0.0.1:23100/employees?tab=active
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_KARIM>",
      "administratorId": "10",
      "email": "karim@invitee.example.test",
      "firstName": "Karim",
      "lastName": "Haddad",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 25000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.203Z",
      "joinedAt": "2026-11-12T18:32:59.957Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Karim Haddad",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_AMINA>",
      "administratorId": "9",
      "email": "amina@invitee.example.test",
      "firstName": "Amina",
      "lastName": "Saadi",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 30000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:56.494Z",
      "joinedAt": "2026-11-12T18:32:58.769Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Amina Saadi",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704177123328",
      "administratorId": "8",
      "email": "perstore@demo.example.test",
      "firstName": "PerStore",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.609Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "PerStore Member",
      "roles": [
        {
          "id": "246703702025445376",
          "name": "Demo first store catalog"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "246703704160346112",
      "administratorId": "7",
      "email": "settingsview@demo.example.test",
      "firstName": "SettingsView",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.605Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "SettingsView Member",
      "roles": [
        {
          "id": "246703700616159232",
          "name": "Demo settings viewer"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704147763200",
      "administratorId": "6",
      "email": "noview@demo.example.test",
      "firstName": "NoView",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.602Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "NoView Member",
      "roles": [
        {
          "id": "246703699307536384",
          "name": "Demo no view"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704130985984",
      "administratorId": "5",
      "email": "orders@demo.example.test",
      "firstName": "Orders",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.598Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Orders Member",
      "roles": [
        {
          "id": "246703697931804672",
          "name": "Demo orders clerk"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    },
    {
      "id": "246703704118403072",
      "administratorId": "4",
      "email": "limited@demo.example.test",
      "firstName": "Limited",
      "lastName": "Member",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:26.595Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Limited Member",
      "roles": [
        {
          "id": "<ROLE_DEMO_VIEWER>",
          "name": "Demo viewer"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO>"
      ],
      "storeNames": [
        "Demo Store"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_OWNER>",
      "administratorId": "2",
      "email": "owner@demo.example.test",
      "firstName": "Demo",
      "lastName": "Owner",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 0,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": null,
      "joinedAt": "2026-11-12T18:32:23.731Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Demo Owner",
      "roles": [
        {
          "id": "246703691921367040",
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
    "all": 10,
    "active": 8,
    "pending": 2,
    "inactive": 0
  },
  "total": 8
}
```

### GET /employees?tab=pending

```http
GET http://127.0.0.1:23100/employees?tab=pending
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_SECOND_STORE_ONLY>",
      "administratorId": null,
      "email": "second-store@invitee.example.test",
      "firstName": null,
      "lastName": null,
      "status": "invited",
      "commissionConfigIds": [],
      "baseSalary": 20000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.953Z",
      "joinedAt": null,
      "tab": "pending",
      "invitationExpired": false,
      "name": null,
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "selected",
      "storeIds": [
        "<STORE_DEMO2>"
      ],
      "storeNames": [
        "Demo Store 2"
      ],
      "ordersCount": 0
    },
    {
      "id": "<MEMBER_PENDING>",
      "administratorId": null,
      "email": "pending@invitee.example.test",
      "firstName": null,
      "lastName": null,
      "status": "invited",
      "commissionConfigIds": [],
      "baseSalary": 20000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:57.689Z",
      "joinedAt": null,
      "tab": "pending",
      "invitationExpired": false,
      "name": null,
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    }
  ],
  "counts": {
    "all": 10,
    "active": 8,
    "pending": 2,
    "inactive": 0
  },
  "total": 2
}
```

### GET /employees?tab=inactive

```http
GET http://127.0.0.1:23100/employees?tab=inactive
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [],
  "counts": {
    "all": 10,
    "active": 8,
    "pending": 2,
    "inactive": 0
  },
  "total": 0
}
```

### GET /employees?tab=all&search=amina

```http
GET http://127.0.0.1:23100/employees?tab=all&search=amina
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<MEMBER_AMINA>",
      "administratorId": "9",
      "email": "amina@invitee.example.test",
      "firstName": "Amina",
      "lastName": "Saadi",
      "status": "active",
      "commissionConfigIds": [],
      "baseSalary": 30000,
      "maxOpenOrders": null,
      "receivingOrders": true,
      "invitedAt": "2026-11-12T18:32:56.494Z",
      "joinedAt": "2026-11-12T18:32:58.769Z",
      "tab": "active",
      "invitationExpired": false,
      "name": "Amina Saadi",
      "roles": [
        {
          "id": "<ROLE_ORDER_MANAGER>",
          "name": "Order manager"
        }
      ],
      "storeAccess": "all",
      "storeIds": [],
      "storeNames": [],
      "ordersCount": 0
    }
  ],
  "counts": {
    "all": 1,
    "active": 1,
    "pending": 0,
    "inactive": 0
  },
  "total": 1
}
```

### GET /employees/:id: the accepted member is active on all stores

```http
GET http://127.0.0.1:23100/employees/<MEMBER_AMINA>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<MEMBER_AMINA>",
  "administratorId": "9",
  "email": "amina@invitee.example.test",
  "firstName": "Amina",
  "lastName": "Saadi",
  "status": "active",
  "commissionConfigIds": [],
  "baseSalary": 30000,
  "maxOpenOrders": null,
  "receivingOrders": true,
  "invitedAt": "2026-11-12T18:32:56.494Z",
  "joinedAt": "2026-11-12T18:32:58.769Z",
  "tab": "active",
  "invitationExpired": false,
  "name": "Amina Saadi",
  "roles": [
    {
      "id": "<ROLE_ORDER_MANAGER>",
      "name": "Order manager"
    }
  ],
  "storeAccess": "all",
  "storeIds": [],
  "storeNames": [],
  "ordersCount": 0
}
```

### teamMembers (GraphQL), the Pending tab

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: TeamMembersInput) { teamMembers(input: $input) { items { id email name status tab invitationExpired roles { name } storeAccess storeNames baseSalary ordersCount } counts { all active pending inactive } total } }",
  "variables": {
    "input": {
      "tab": "pending"
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "teamMembers": {
      "items": [
        {
          "id": "<MEMBER_SECOND_STORE_ONLY>",
          "email": "second-store@invitee.example.test",
          "name": null,
          "status": "invited",
          "tab": "pending",
          "invitationExpired": false,
          "roles": [
            {
              "name": "Order manager"
            }
          ],
          "storeAccess": "selected",
          "storeNames": [
            "Demo Store 2"
          ],
          "baseSalary": 20000,
          "ordersCount": 0
        },
        {
          "id": "<MEMBER_PENDING>",
          "email": "pending@invitee.example.test",
          "name": null,
          "status": "invited",
          "tab": "pending",
          "invitationExpired": false,
          "roles": [
            {
              "name": "Order manager"
            }
          ],
          "storeAccess": "all",
          "storeNames": [],
          "baseSalary": 20000,
          "ordersCount": 0
        }
      ],
      "counts": {
        "all": 10,
        "active": 8,
        "pending": 2,
        "inactive": 0
      },
      "total": 2
    }
  }
}
```

