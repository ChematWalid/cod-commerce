# Email verification

Link and code. A GET on the link route spends nothing (Review Focus 1). Tokens and codes are redacted.

### accountStatus before verifying

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
      "emailVerified": false,
      "verificationRequired": true,
      "resendAvailableAt": "2026-11-13T12:30:03.639Z",
      "pendingEmail": null
    }
  }
}
```

### A GET on the token route, as a mail scanner would: nothing spent

```http
GET http://127.0.0.1:23100/auth/verify-email/<VERIFY_TOKEN_A>

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8

{
  "statusCode": 404,
  "message": "Cannot GET /auth/verify-email/<VERIFY_TOKEN_A>",
  "timestamp": "2026-11-13T12:29:12.545Z",
  "path": "/auth/verify-email/<VERIFY_TOKEN_A>"
}
```

### verifyEmail with the link's token, after that GET

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!) { verifyEmail(token: $token) { success } }",
  "variables": {
    "token": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "verifyEmail": {
      "success": true
    }
  }
}
```

### Replay of a spent link

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($token: String!) { verifyEmail(token: $token) { success } }",
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
        "verifyEmail"
      ],
      "extensions": {
        "code": "auth.invalid-token"
      }
    }
  ],
  "data": null
}
```

### accountStatus after verifying

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
      "resendAvailableAt": "2026-11-13T12:30:03.639Z",
      "pendingEmail": null
    }
  }
}
```

### POST /auth/verify-email/:token

```http
POST http://127.0.0.1:23100/auth/verify-email/<VERIFY_TOKEN_C>

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### The same POST again: refused

```http
POST http://127.0.0.1:23100/auth/verify-email/<VERIFY_TOKEN_C>

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8

{
  "statusCode": 400,
  "code": "auth.invalid-token",
  "message": "This link is invalid or has expired",
  "path": "/auth/verify-email/<VERIFY_TOKEN_C>"
}
```

### verifyEmailOtp, wrong code

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }",
  "variables": {
    "code": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "This code is invalid or has expired",
      "locations": [
        {
          "line": 1,
          "column": 29
        }
      ],
      "path": [
        "verifyEmailOtp"
      ],
      "extensions": {
        "code": "auth.otp-invalid"
      }
    }
  ],
  "data": null
}
```

### resendEmailVerification inside the 60 s cooldown

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation { resendEmailVerification { sentAt nextAllowedAt } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "errors": [
    {
      "message": "Please wait before asking again",
      "locations": [
        {
          "line": 1,
          "column": 12
        }
      ],
      "path": [
        "resendEmailVerification"
      ],
      "extensions": {
        "code": "auth.cooldown"
      }
    }
  ],
  "data": null
}
```

### resendEmailVerification after the cooldown

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation { resendEmailVerification { sentAt nextAllowedAt } }",
  "variables": {}
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "resendEmailVerification": {
      "sentAt": "2026-11-13T12:30:15.513Z",
      "nextAllowedAt": "2026-11-13T12:31:15.513Z"
    }
  }
}
```

### verifyEmailOtp with the newest code

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }",
  "variables": {
    "code": "[REDACTED]"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "verifyEmailOtp": {
      "success": true
    }
  }
}
```

### POST /auth/verify-email-otp

```http
POST http://127.0.0.1:23100/auth/verify-email-otp
Authorization: Bearer [REDACTED]

{
  "code": "[REDACTED]"
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

