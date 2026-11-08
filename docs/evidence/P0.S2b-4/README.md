# Evidence for P0.S2b-4 (dashboard with RTL)

Screenshots of the real merchant dashboard (`@vendure/dashboard` 3.8.1 with the `plugins/merchant-shell` extension,
ADR 0010) served by a live run of the compose stack (CLAUDE.md §3a.14). Produced by
`scripts/evidence/P0.S2b-4.sh`; nothing here is hand-written. Data is synthetic (placeholders from `.env.example`).

- Image: `cod-platform:local`, built by that run (`docker compose build migrate`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is `0136f21`.
- Base URL: `http://127.0.0.1:23100/dashboard` (compose project `cod-evidence`, host port 23100).
- Viewport screenshots (not full page), `reducedMotion: reduce`, taken after `networkidle` and `document.fonts.ready`.

| File | URL | Viewport | Language | `dir` / `lang` asserted |
| --- | --- | --- | --- | --- |
| [`login-ar-desktop.png`](screens/login-ar-desktop.png) | `/dashboard/login` | desktop 1280x800, scale 1 | ar | `rtl` / `ar` |
| [`merchant-shell-ar-desktop.png`](screens/merchant-shell-ar-desktop.png) | `/dashboard/merchant-shell` | desktop 1280x800, scale 1 | ar | `rtl` / `ar` |
| [`login-en-desktop.png`](screens/login-en-desktop.png) | `/dashboard/login` | desktop 1280x800, scale 1 | en | `ltr` / `en` |
| [`merchant-shell-en-desktop.png`](screens/merchant-shell-en-desktop.png) | `/dashboard/merchant-shell` | desktop 1280x800, scale 1 | en | `ltr` / `en` |
| [`login-ar-mobile.png`](screens/login-ar-mobile.png) | `/dashboard/login` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` |
| [`merchant-shell-ar-mobile.png`](screens/merchant-shell-ar-mobile.png) | `/dashboard/merchant-shell` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` |
| [`login-en-mobile.png`](screens/login-en-mobile.png) | `/dashboard/login` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` |
| [`merchant-shell-en-mobile.png`](screens/merchant-shell-en-mobile.png) | `/dashboard/merchant-shell` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` |

## Checks (the script fails otherwise)

- Every page, login and shell: `document.documentElement.dir` is `rtl` for Arabic and `ltr` for English, and `lang` is `ar` / `en`.
- Shell pages: the `merchant-shell-placeholder` marker is present.
- Arabic shell pages: the `IBM Plex Sans Arabic` FontFace is `loaded`, and the body font family contains it.
- Every PNG is at most 300 KB (the 8 files must all exist); no password or cookie secret appears in this folder.

## How the language is chosen

- **Dashboard pages:** the user menu → Language dialog (the helpers `loginAsSuperadmin` and `setDisplayLanguage` of
  `apps/server/tests/browser/dashboard-session.ts`). The choice is stored on the server and in the browser's
  `localStorage` key `vendure-user-settings`.
- **Login page:** 3.8.1 has no language picker on the login page and the page does not follow the browser locale. It reads the
  display language persisted in `localStorage` by an earlier in-app switch. The script therefore signs in, switches the language,
  shoots the shell page, signs out (the dashboard's `logout` mutation) and opens `/dashboard/login`, which then renders in the
  persisted language. For a first-time visitor (empty `localStorage`) the login page is always English.

## Notes

- **Mobile sessions:** on a phone-width viewport the user menu is inside the collapsed sidebar, so the sign-in and the language
  switch run in a desktop-sized context. Its storage state (session cookies and `localStorage`) opens the 390x844 context that
  takes the shots; the mobile pages are loaded in the language chosen there.
- **Untranslated strings:** the `Merchant shell` page title and the `Administration` sidebar label stay English in the Arabic
  shots. The placeholder page has no translation catalog in P0 (no `.po` files), and the sidebar section label is not
  translated by the dashboard.

## Re-run

```bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-4.sh
```

It uses its own compose project (`cod-evidence`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
