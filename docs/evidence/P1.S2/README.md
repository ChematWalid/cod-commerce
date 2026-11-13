# Evidence for P1.S2 (accounts and auth)

Transcripts, emails and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S2.sh`. Data is
synthetic. Image built from a tree with no uncommitted change outside the evidence folders and browser tests, last
image-relevant commit `f32bd2ae76915919ff1720bf44f3622e6d1bf66b`. Compose project `cod-evidence`; a second api container on port 23101 runs with
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
- verify-link en: confirmed, token left the URL
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

Run of 2026-11-13 (`fix/s4-audit-evidence`, #134): every screen in all four variants, Arabic and English at 1280x800 and 390x844,
80 shots. All 80 were opened, four variants side by side per screen.

Applies to every shot unless a row says otherwise: the product name is CodShop, the only third-party name is the
licence-required login footer on the public pages (`Vendure v3.8.1`, ADR 0001), no other product name or logo. Arabic shots are
`dir=rtl`, labels and text right-aligned, Arabic font loaded; English shots are `dir=ltr`. Layout intact at both sizes with no
horizontal overflow (asserted by the script too). Signed-in shots use the merchant shell (P1.S5): store switcher with the store
name and slug in the top bar, no sidebar header or footer, sidebar collapsed to its trigger on mobile.

| File(s) | Seen |
| --- | --- |
| `login-*` | Welcome text, two fields, forgot link (at the inline end, so the left in Arabic), Sign in, "Create account". No provider button. Footer present. |
| `forgot-*`, `reset-*` | Stock pages under our brand, translated, footer present. No language switch: the language is the browser's saved one. The long Arabic reset title wraps to two lines on mobile, centred. |
| `register-1-*` | Three-segment progress, filling from the right in Arabic. Name fields side by side on desktop, stacked on mobile. Password hint translated. |
| `register-2-*` | Business name, Back and Continue; in Arabic Continue sits on the left. |
| `register-3-*` | Store name, address with the `.localhost` suffix, "available" in green, language select, logo picker, Create enabled. In Arabic the input is on the left and the suffix to its right, reading `free-1.localhost`. |
| `register-rate-limited-*` | Real 429 from the server: translated "too many checks" message in red, Create greyed out. Each variant uses its own address (`retry-<lang>-<viewport>-1`). |
| `verify-*`, `verify-link-*` | Title, one sentence, one button: the token is spent only on the click. |
| `verify-link-done-*`, `confirm-email-done-*` | Success sentence and "Go to dashboard"; the address bar has no query (asserted). |
| `confirm-email-*` | Translated title, sentence, button. |
| `banner-*` | Banner above Home with code field, Verify, and Resend greyed during the cooldown. On mobile the controls wrap and stay inside the card. |
| `profile-*` | Photo picker, names, phone, read-only email. Banner above, as expected for an unverified account. |
| `security-*` | Change password and change email blocks, banner above. The mobile shot is cropped at the viewport. |
| `security-password-changed-*` | One translated success toast, fields cleared. No banner: the owner verified earlier in the run. On mobile the toast covers the top bar. |
| `security-email-pending-*` | One toast and "waiting for confirmation" with the new address, which stays left-to-right inside the Arabic sentence. On Arabic mobile the address wraps after `owner-ar-new-`. |
| `oauth-on-login-*`, `oauth-on-register-*` | Flag on: "Continue with Google" and "Continue with Facebook" as plain text buttons with no provider logo. |
| `oauth-on-register-prefilled-*` | Email and names from the mock provider, no password field. On mobile the long email is cut at the input's edge (a normal input). |

### Defects

- **Resolved since the last run.** The hard-coded "Administration" sidebar label and the hex channel code in the switcher are gone:
  the merchant shell (P1.S5) hides the sidebar header and shows the store name and slug in the top-bar switcher.
- **Fixed earlier, still holds.** On an Arabic page the address suffix reads `free-1.localhost` (commit `7fae30d`).
- **Cosmetic, not fixed.** The Arabic mobile "waiting for confirmation" line breaks the address at the hyphen. Readable; a
  `break-all`/`dir=ltr` span would keep it whole. Left for the profile owner.
- **Data, not a defect.** Only one toast shows on the security shots: the script now waits for the previous toast to close.
