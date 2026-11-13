# Isolation: account

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### account.profile (A attacks B)

A's owner reads the account profile: A's own. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "accountProfile": {
      "firstName": "OwnerA",
      "lastName": "PrivateAb8b7305f",
      "emailAddress": "owner-a-b8b7305f@example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": false
    }
  }
}
```

### account.profile-victim-channel (A attacks B)

A's owner reads the account profile with B's store token: A's own, nothing of B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "accountProfile": {
      "firstName": "OwnerA",
      "lastName": "PrivateAb8b7305f",
      "emailAddress": "owner-a-b8b7305f@example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": false
    }
  }
}
```

### account.profile-victim-channel (B attacks A)

A's owner reads the account profile with B's store token: A's own, nothing of B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner B]
vendure-token: <TOKEN_A1>


query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "accountProfile": {
      "firstName": "OwnerB",
      "lastName": "PrivateBb8b7305f",
      "emailAddress": "owner-b-b8b7305f@example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": false
    }
  }
}
```

### account.rest-profile-victim-channel (A attacks B)

A's owner GETs /auth/profile with B's store token: A's own, nothing of B. **Pass.**

```http
GET /auth/profile
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>

```

**HTTP 200**

```json
{
  "firstName": "OwnerA",
  "lastName": "PrivateAb8b7305f",
  "emailAddress": "owner-a-b8b7305f@example.test",
  "phone": null,
  "avatarUrl": null,
  "emailVerified": false
}
```

### account.status-victim-channel (A attacks B)

A's owner reads the account status and email with B's store token: A's own, nothing of B. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } accountProfile { emailAddress } }

variables: {}
```

**HTTP 200**

```json
{
  "data": {
    "accountStatus": {
      "emailVerified": false,
      "verificationRequired": true,
      "resendAvailableAt": null,
      "pendingEmail": null
    },
    "accountProfile": {
      "emailAddress": "owner-a-b8b7305f@example.test"
    }
  }
}
```

### account.update-profile-victim-channel (A attacks B)

A's owner updates the account profile with B's store token: writes A only, B's profile untouched. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { firstName lastName emailAddress phone avatarUrl emailVerified } }

variables: {
  "input": {
    "lastName": "PrivateAb8b7305f"
  }
}
```

**HTTP 200**

```json
{
  "data": {
    "updateAccountProfile": {
      "firstName": "OwnerA",
      "lastName": "PrivateAb8b7305f",
      "emailAddress": "owner-a-b8b7305f@example.test",
      "phone": null,
      "avatarUrl": null,
      "emailVerified": false
    }
  }
}
```

### account.rest-update-profile-victim-channel (A attacks B)

A's owner PATCHes /auth/profile with B's store token: writes A only, B's profile untouched. **Pass.**

```http
PATCH /auth/profile
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_B1>


{
  "lastName": "PrivateAb8b7305f"
}
```

**HTTP 200**

```json
{
  "firstName": "OwnerA",
  "lastName": "PrivateAb8b7305f",
  "emailAddress": "owner-a-b8b7305f@example.test",
  "phone": null,
  "avatarUrl": null,
  "emailVerified": false
}
```

### stock.update-active-administrator-email (A attacks B)

A's owner takes B's owner email through the stock profile save: auth.use-account-security. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }

variables: {
  "input": {
    "emailAddress": "owner-b-b8b7305f@example.test"
  }
}
```

**HTTP 200**

```json
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
