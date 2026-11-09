# The Shop API refuses an administrator

An administrator's session also works on the Shop API, so its account mutations are shadowed (D21). Passwords redacted.

### updateCustomerPassword as an administrator: refused

```http
POST http://127.0.0.1:23100/shop-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($current: String!, $next: String!) { updateCustomerPassword(currentPassword: $current, newPassword: $next) { __typename } }",
  "variables": {
    "current": "[REDACTED]",
    "next": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Change your email or password from the account security page.",
      "locations": [
        {
          "line": 1,
          "column": 48
        }
      ],
      "path": [
        "updateCustomerPassword"
      ],
      "extensions": {
        "code": "auth.use-account-security"
      }
    }
  ],
  "data": null
}
```

### requestUpdateCustomerEmailAddress as an administrator: refused before the password is looked at

```http
POST http://127.0.0.1:23100/shop-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($password: String!, $email: String!) { requestUpdateCustomerEmailAddress(password: $password, newEmailAddress: $email) { __typename } }",
  "variables": {
    "password": "[REDACTED]",
    "email": "moved-1@evidence.example.test"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Change your email or password from the account security page.",
      "locations": [
        {
          "line": 1,
          "column": 50
        }
      ],
      "path": [
        "requestUpdateCustomerEmailAddress"
      ],
      "extensions": {
        "code": "auth.use-account-security"
      }
    }
  ],
  "data": null
}
```

### requestPasswordReset with an administrator's email: the answer an unknown email gets, and no token is stored

```http
POST http://127.0.0.1:23100/shop-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { __typename ... on Success { success } } }",
  "variables": {
    "email": "shop-guard-1@evidence.example.test"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "requestPasswordReset": {
      "__typename": "Success",
      "success": true
    }
  }
}
```

