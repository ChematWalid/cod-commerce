# Evidence for P1.S2 (accounts and auth)

Transcripts, emails and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S2.sh`. Data is
synthetic. Image built from a tree with no uncommitted change outside the evidence folders and browser tests, last
image-relevant commit `881089ca8faceeaaa433597ecfd0e177207136a9`. Compose project `cod-evidence`; a second api container on port 23101 runs with
`AUTH_OAUTH_ENABLED=true` against a mock provider (`scripts/evidence/P1.S2-oauth-mock.mjs`).

## API transcripts

| File | Shows |
| --- | --- |
| [`api/config.md`](api/config.md) | Public configuration; flag off answers 404 |
| [`api/register.md`](api/register.md) | `registerMerchant`, `POST /auth/register`, taken email, weak password, taken subdomain |
| [`api/login.md`](api/login.md) | Login (wrong password equals unknown email), `POST /auth/login`, `POST /auth/logout`, logout ends one session |
| [`api/verify.md`](api/verify.md) | `verifyEmail`, a scanner's GET spends nothing, replay, OTP wrong and right, resend cooldown, both REST routes |
| [`api/password.md`](api/password.md) | Forgot, reset, replay, change (other sessions end, this one stays), the stock mutation refused |
| [`api/email-change.md`](api/email-change.md) | Request, confirm, replay, old email refused, new email signs in, both REST routes |
| [`api/profile.md`](api/profile.md) | `accountProfile`, `updateAccountProfile`, REST GET and PATCH, anonymous 403, `uploadBusinessLogo` |
| [`api/isolation.md`](api/isolation.md) | Cross-tenant: A's owner on B's channel and B's ids |
| [`api/rate-limit.md`](api/rate-limit.md) | Real 429 with Retry-After, `RATE_LIMITED` on GraphQL, login throttle |
| [`api/oauth.md`](api/oauth.md) | Flag on against the mock: providers, 302 with PKCE, forged callback, unknown provider, the success callback issuing a ticket, `POST /auth/oauth/ticket` for its browser and refused for another |
| [`api/shop-guards.md`](api/shop-guards.md) | Shop API with an administrator's session: password change and email change refused, forgot-password answers as for an unknown email |

## Emails

[`emails/`](emails/): verification, password reset, password changed, email change confirmation and notice, one Arabic and one
English each, read from the Mailpit API. Tokens and codes redacted. Ids and channel tokens in the transcripts are placeholders;
every assertion ran on the real values.

## Browser flows proved by `scripts/evidence/P1.S2-screens.mjs`

Every line below is a failing assertion in the script if it does not hold; the shots are in `screens/`.

- availability retry ar: 429 and failed check both recovered
- availability retry en: 429 and failed check both recovered
- verify-link ar: confirmed, token left the URL
- otp en: banner gone
- confirm-email ar: confirmed, token left the URL
- ar: signed in with the new email and the new password
- ar: reset through the stock pages landed signed in
- confirm-email en: confirmed, token left the URL
- en: signed in with the new email and the new password
- en: reset through the stock pages landed signed in
- oauth off: no provider button; login footer present
- oauth on: both buttons, provider sign-up through the mock landed on Home, no banner

## What was seen in each screenshot (opened by eye, CLAUDE.md §3a.17)

Applies to every shot unless a row says otherwise: the product name is CodShop, the only third-party name is the
licence-required login footer on the public pages (`Vendure v3.8.1`, ADR 0001), no other product name or logo. Arabic shots are
`dir=rtl`, labels and text right-aligned, Arabic font loaded; English shots are `dir=ltr`. Layout intact at 1280x800 and at
390x844 with no horizontal overflow (asserted by the script too).

| File(s) | Seen |
| --- | --- |
| `login-{ar,en}-{desktop,mobile}.png` | Welcome text, two fields, forgot link (at the inline end, so the left in Arabic), Sign in, "Create account". No provider button. Footer present. |
| `forgot-*`, `reset-*` | Stock pages under our brand, translated, footer present. They have no language switch: the language is the browser's saved one. |
| `register-1-*` | Three-segment progress, filling from the right in Arabic. Name fields side by side on desktop, stacked on mobile. Password hint translated. |
| `register-2-*` | Business name, Back and Continue. |
| `register-3-*` | Store name, address with the `.localhost` suffix, language select, logo picker, Create enabled once available. In Arabic the input is on the left and the suffix to its right, reading `free-1.localhost`, after the fix below. |
| `register-rate-limited-{ar,en}-desktop.png` | Real 429 from the server: translated "too many checks" message in red, Create greyed out. The script then saw the same value recover with no edit. |
| `verify-*`, `verify-link-ar-desktop.png` | Title, one sentence, one button: the token is spent only on the click. |
| `verify-link-done-ar-desktop.png`, `confirm-email-done-{ar,en}-desktop.png` | Success sentence and "Go to dashboard"; the address bar has no query (asserted). |
| `confirm-email-{ar,en}-desktop.png` | Translated title, sentence, button. |
| `banner-{ar,en}-{desktop,mobile}.png` | Banner above Home with code field, Verify, and Resend greyed during the cooldown. On mobile the controls wrap to two rows and stay inside the card. |
| `profile-*` | Photo picker, names, phone, read-only email. Banner above, as expected for an unverified account. |
| `security-*` | Change password and change email blocks. The mobile shot is full-page. |
| `security-password-changed-{ar,en}-desktop.png` | Translated success toast, fields cleared. |
| `security-email-pending-{ar,en}-desktop.png` | Toast and "waiting for confirmation" with the new address, which stays left-to-right inside the Arabic sentence. A second toast is partly hidden behind the first: the password toast has not expired yet. |
| `oauth-on-login-en-desktop.png`, `oauth-on-register-en-desktop.png` | Flag on: "Continue with Google" and "Continue with Facebook" as plain text buttons with no provider logo. |
| `oauth-on-register-prefilled-en-desktop.png` | Email and names from the mock provider, no password field. |

### Defects

- **Fixed.** On an Arabic page the address suffix sat to the left of the input and read `localhost.`: the stock stylesheet sets
  `direction: rtl` on every element, so `dir="ltr"` had no effect. `text-field.tsx` now sets the direction inline on the row and
  the suffix (commit `7fae30d`), with a browser test.
- **Fixed in the test helper.** `assertNoPageError` took the verification banner, which has `role="alert"`, for a page error, and
  seven existing browser tests failed for seeded owners. The helper now skips the banner.
- **Not fixed, outside the auth screens.** The sidebar group label "Administration" is hard-coded English in the stock dashboard
  (`nav-main.tsx`), so it shows on Arabic pages. For P1.S5, with the channel switcher.
- **Not fixed, known.** The channel switcher shows a hex channel code in place of the store name (P1.S5, already deferred by P1.S1).
- **Data, not a defect.** The English merchant's sidebar reads "Language: Arabic": that is the store language, and the wizard's default was kept.

### Run of 2026-11-09 (final fix wave)

Against the previous run, 45 of the 55 shots are pixel-identical. The other 10 (`banner-*-desktop`, `profile-*-desktop`,
`security-*-desktop`, `security-password-changed-*-desktop`, `security-email-pending-*-desktop`, Arabic and English) differ only in the
store switcher at the top of the sidebar, where the random hex channel code of this run's stack shows (the known P1.S5 item above). A
pixel comparison gave a change box of about 140 by 12 pixels on each; `banner-ar-desktop` and `security-email-pending-en-desktop` were
opened to confirm it. No screen changed in layout or wording: this fix wave changed no dashboard code.
