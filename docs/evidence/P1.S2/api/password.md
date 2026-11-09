# Forgot, reset and change password

Forgot answers the same for an unknown email. Tokens and passwords redacted; a spent token is refused.

### requestPasswordReset, known email

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($emailAddress: String!) { requestPasswordReset(emailAddress: $emailAddress) { __typename ... on Success { success } } }",
  "variables": {
    "emailAddress": "api-a-1@evidence.example.test"
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

### requestPasswordReset, unknown email: the same answer, no email

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($emailAddress: String!) { requestPasswordReset(emailAddress: $emailAddress) { __typename ... on Success { success } } }",
  "variables": {
    "emailAddress": "nobody-1@evidence.example.test"
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

### resetPassword: signs the owner in

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "token": "[REDACTED]",
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
    "resetPassword": {
      "__typename": "CurrentUser",
      "identifier": "api-a-1@evidence.example.test"
    }
  }
}
```

### Replay of a spent reset token

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "token": "[REDACTED]",
    "password": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "resetPassword": {
      "__typename": "PasswordResetTokenInvalidError",
      "errorCode": "PASSWORD_RESET_TOKEN_INVALID_ERROR",
      "message": "Password reset token not recognized"
    }
  }
}
```

### changeAccountPassword, wrong current password

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($currentPassword: String!, $newPassword: String!) { changeAccountPassword(currentPassword: $currentPassword, newPassword: $newPassword) { success } }",
  "variables": {
    "currentPassword": "[REDACTED]",
    "newPassword": "[REDACTED]"
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
          "column": 63
        }
      ],
      "path": [
        "changeAccountPassword"
      ],
      "extensions": {
        "code": "auth.current-password-wrong"
      }
    }
  ],
  "data": null
}
```

### changeAccountPassword

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($currentPassword: String!, $newPassword: String!) { changeAccountPassword(currentPassword: $currentPassword, newPassword: $newPassword) { success } }",
  "variables": {
    "currentPassword": "[REDACTED]",
    "newPassword": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "changeAccountPassword": {
      "success": true
    }
  }
}
```

### Another session of that account: ended at once (Review Focus 3)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }",
  "variables": {}
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; expires=Tue, 09 Nov 2027 14:26:36 GMT; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; expires=Tue, 09 Nov 2027 14:26:36 GMT; samesite=lax; httponly

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
        "accountStatus"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### The session that changed it: kept

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
      "pendingEmail": null
    }
  }
}
```

### The stock updateActiveAdministrator cannot change a password (D21)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }",
  "variables": {
    "input": {
      "password": "[REDACTED]"
    }
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
          "column": 54
        }
      ],
      "path": [
        "updateActiveAdministrator"
      ],
      "extensions": {
        "code": "auth.use-account-security"
      }
    }
  ],
  "data": null
}
```

### POST /auth/forgot-password

```http
POST http://127.0.0.1:23100/auth/forgot-password

{
  "email": "api-e-1@evidence.example.test"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### POST /auth/reset-password

```http
POST http://127.0.0.1:23100/auth/reset-password

{
  "token": "[REDACTED]",
  "password": "[REDACTED]"
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "id": "8",
  "identifier": "api-e-1@evidence.example.test"
}
```

### POST /auth/change-password

```http
POST http://127.0.0.1:23100/auth/change-password
Authorization: Bearer [REDACTED]

{
  "currentPassword": "[REDACTED]",
  "newPassword": "[REDACTED]"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

