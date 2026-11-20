# Store A1's token verified in store A2: store_mismatch

Same business, another store: the signature holds but the token names store A1 (AC7, multi-tenant).

- Call: `PricingService.verifyQuoteForScope(ctx, scope, token, cart)` (in process, no HTTP route before P3.S3)
- Store: A2 (business A, store `demo2`)

## Input

```json
{
  "token": "qt1.eyJhIjpbXSwiYiI6IjI0OTQzNTA3NDg1OTExNDQ5NiIsImQiOltdLCJleHAiOjE3OTUxNjA0OTQsImgiOiJjMDM1N2UwNDhiZDZkMzZlMGQ5MDJkM2MyYTFhNjVlZjQ5ZTQ5ZTg2ZWEyY2E2M2E5ZTIyZmNiNDI4NzJkY2RjIiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6WyIyNDk0MzUyMzAzMjkzODA4NjQiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjQ0MTAsInZhcmlhbnRJZCI6IjE3In0seyJvZmZlcklkcyI6WyIyNDk0MzUyMzAzMjkzODA4NjQiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjQ0MTAsInZhcmlhbnRJZCI6IjE4In1dLCJuIjoiR3QzOXdFT0pfWlVoYUlzQSIsInAiOjAsInMiOiIyNDk0MzUwNzUwNjg4Mjk2OTYiLCJzaCI6ODAwLCJ0Ijo5NjIwLCJ2IjoxfQ.[REDACTED]",
  "cart": {
    "channel": "storefront",
    "lines": [
      {
        "variantId": "17",
        "quantity": 1
      },
      {
        "variantId": "18",
        "quantity": 1
      }
    ],
    "destination": {
      "provinceCode": "16",
      "stopdesk": false
    }
  }
}
```

## Output

```json
{
  "ok": false,
  "reason": "store_mismatch"
}
```
