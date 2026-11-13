# Isolation: flag override

Live transcripts from `scripts/evidence/P1-isolation.sh`. Ids and store tokens are placeholders; sessions are named, never shown.

### flag.list (A attacks B)

A's owner lists feature flags, which hold every business's overrides: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query { featureFlags { key defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }

variables: {}
```

**HTTP 200**

```json
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
        "featureFlags"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### flag.evaluate (A attacks B)

A's owner evaluates a flag for B's business: FORBIDDEN. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }

variables: {
  "key": "ai.enabled",
  "businessId": "<BUSINESS_B>"
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 46
        }
      ],
      "path": [
        "evaluateFeatureFlag"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### flag.set-override (A attacks B)

A's owner sets a flag override on B's business: FORBIDDEN, B's override unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: FeatureFlagOverrideInput!) { setFeatureFlagOverride(input: $input) { key defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }

variables: {
  "input": {
    "key": "ai.enabled",
    "scope": "BUSINESS",
    "scopeId": "<BUSINESS_B>",
    "enabled": false
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 48
        }
      ],
      "path": [
        "setFeatureFlagOverride"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### flag.remove-override (A attacks B)

A's owner removes B's flag override: FORBIDDEN, B's override survives. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: FeatureFlagOverrideKeyInput!) { removeFeatureFlagOverride(input: $input) { key defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }

variables: {
  "input": {
    "key": "ai.enabled",
    "scope": "BUSINESS",
    "scopeId": "<BUSINESS_B>"
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 51
        }
      ],
      "path": [
        "removeFeatureFlagOverride"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```

### flag.update (A attacks B)

A's owner turns a platform-wide flag on for every business: FORBIDDEN, the flag unchanged. **Pass.**

```http
POST /admin-api
authorization: Bearer [session of owner A]
vendure-token: <TOKEN_A1>


mutation ($input: UpdateFeatureFlagInput!) { updateFeatureFlag(input: $input) { key defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }

variables: {
  "input": {
    "key": "ai.enabled",
    "defaultEnabled": true
  }
}
```

**HTTP 200**

```json
{
  "errors": [
    {
      "message": "You are not currently authorized to perform this action",
      "locations": [
        {
          "line": 1,
          "column": 46
        }
      ],
      "path": [
        "updateFeatureFlag"
      ],
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ],
  "data": null
}
```
