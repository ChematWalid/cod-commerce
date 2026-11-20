# The 2-piece token, verified with its own cart: ok

The token of `quote-2-pieces-home` (total 9,620), checked in the store that signed it with the same cart (AC7).

- Call: `PricingService.verifyQuoteForScope(ctx, scope, token, cart)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

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
  "ok": true,
  "payload": {
    "v": 1,
    "kid": "k1",
    "b": "<BUSINESS_A>",
    "s": "<STORE_A1>",
    "h": "c0357e048bd6d36e0d902d3c2a1a65ef49e49e86ea2ca63a9e22fcb42872dcdc",
    "p": 0,
    "exp": 1795160494,
    "t": 9620,
    "sh": 800,
    "l": [
      {
        "variantId": "17",
        "qty": 1,
        "unitPrice": 4410,
        "originalPrice": 4900,
        "offerIds": [
          "<OFFER_QUANTITY>"
        ]
      },
      {
        "variantId": "18",
        "qty": 1,
        "unitPrice": 4410,
        "originalPrice": 4900,
        "offerIds": [
          "<OFFER_QUANTITY>"
        ]
      }
    ],
    "d": [],
    "a": [],
    "n": "Gt39wEOJ_ZUhaIsA"
  }
}
```
