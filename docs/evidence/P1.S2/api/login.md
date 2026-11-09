# Login and logout

The same answer for a wrong password and an unknown email. Logout ends only the calling session (D22).

### login: wrong password

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

### login: unknown email, the same answer

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json

{
  "query": "mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }",
  "variables": {
    "username": "nobody-1@evidence.example.test",
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

### login

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
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "data": {
    "login": {
      "__typename": "CurrentUser",
      "identifier": "api-a-1@evidence.example.test"
    }
  }
}
```

### logout

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]

{
  "query": "mutation { logout { success } }",
  "variables": {}
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
cache-control: no-store
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "data": {
    "logout": {
      "success": true
    }
  }
}
```

### The account's other session still works

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
      "resendAvailableAt": "2026-11-09T07:28:58.774Z",
      "pendingEmail": null
    }
  }
}
```

### The ended session no longer works

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
set-cookie: session=[REDACTED]; path=/; expires=Tue, 09 Nov 2027 13:28:06 GMT; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; expires=Tue, 09 Nov 2027 13:28:06 GMT; samesite=lax; httponly

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

### POST /auth/login

```http
POST http://127.0.0.1:23100/auth/login

{
  "username": "api-b-1@evidence.example.test",
  "password": "[REDACTED]"
}

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "id": "5",
  "identifier": "api-b-1@evidence.example.test"
}
```

### POST /auth/login, wrong password

```http
POST http://127.0.0.1:23100/auth/login

{
  "username": "api-b-1@evidence.example.test",
  "password": "[REDACTED]"
}

HTTP/1.1 401 Unauthorized
content-type: application/json; charset=utf-8

{
  "statusCode": 401,
  "message": "Invalid credentials",
  "timestamp": "2026-11-09T07:28:07.262Z",
  "path": "/auth/login"
}
```

### POST /auth/logout

```http
POST http://127.0.0.1:23100/auth/logout
Authorization: Bearer [REDACTED]

HTTP/1.1 200 OK
vendure-auth-token: [REDACTED]
content-type: application/json; charset=utf-8
set-cookie: session=[REDACTED]; path=/; samesite=lax; httponly
set-cookie: session.sig=[REDACTED]; path=/; samesite=lax; httponly

{
  "success": true
}
```

