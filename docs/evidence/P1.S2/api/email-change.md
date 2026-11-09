# Email change

Needs the current password; nothing switches until the new address confirms. Tokens and passwords redacted.

### requestEmailChange, wrong password

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($newEmail: String!, $currentPassword: String!) { requestEmailChange(newEmail: $newEmail, currentPassword: $currentPassword) { success } }",
  "variables": {
    "newEmail": "api-a-new-1@evidence.example.test",
    "currentPassword": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "The current password is wrong",
      "locations": [
        {
          "line": 1,
          "column": 60
        }
      ],
      "path": [
        "requestEmailChange"
      ],
      "extensions": {
        "code": "auth.current-password-wrong"
      }
    }
  ],
  "data": null
}
```

### requestEmailChange

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($newEmail: String!, $currentPassword: String!) { requestEmailChange(newEmail: $newEmail, currentPassword: $currentPassword) { success } }",
  "variables": {
    "newEmail": "api-a-new-1@evidence.example.test",
    "currentPassword": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "requestEmailChange": {
      "success": true
    }
  }
}
```

### accountStatus: pending

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "accountStatus": {
      "emailVerified": true,
      "verificationRequired": true,
      "resendAvailableAt": null,
      "pendingEmail": "api-a-new-1@evidence.example.test"
    }
  }
}
```

### confirmEmailChange

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!) { confirmEmailChange(token: $token) { success } }",
  "variables": {
    "token": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "confirmEmailChange": {
      "success": true
    }
  }
}
```

### Replay of a spent confirmation

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!) { confirmEmailChange(token: $token) { success } }",
  "variables": {
    "token": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This link is invalid or has expired",
      "locations": [
        {
          "line": 1,
          "column": 30
        }
      ],
      "path": [
        "confirmEmailChange"
      ],
      "extensions": {
        "code": "auth.invalid-token"
      }
    }
  ],
  "data": null
}
```

### login with the old email: refused

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "api-a-1@evidence.example.test",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "login": {
      "__typename": "InvalidCredentialsError",
      "errorCode": "INVALID_CREDENTIALS_ERROR",
      "message": "The provided credentials are invalid"
    }
  }
}
```

### login with the new email

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "api-a-new-1@evidence.example.test",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "data": {
    "login": {
      "__typename": "CurrentUser",
      "identifier": "api-a-new-1@evidence.example.test"
    }
  }
}
```

### POST /auth/change-email-request

```http
POST http://127.0.0.1:23100/auth/change-email-request
Authorization: Bearer [REDACTED]

{
  "newEmail": "api-c-new-1@evidence.example.test",
  "currentPassword": "[REDACTED]"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### POST /auth/confirm-email-change

```http
POST http://127.0.0.1:23100/auth/confirm-email-change

{
  "token": "[REDACTED]"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

