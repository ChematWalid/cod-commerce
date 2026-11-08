# Evidence for P0.S2b-4 (dashboard with RTL)

Screenshots of the real merchant dashboard (`@vendure/dashboard` 3.8.1 with the `plugins/merchant-shell` extension,
ADR 0010) served by a live run of the compose stack (CLAUDE.md §3a.14). Generated on 2026-11-08 by
`scripts/evidence/P0.S2b-4.sh`; nothing here is hand-written. Data is synthetic (placeholders from `.env.example`).

- Image: `sha256:27c92df4c270` (`cod-platform:local`), built from commit `28d4225`.
- Base URL: `http://127.0.0.1:23100/dashboard` (compose project `cod-evidence`, host port 23100).
- Viewport screenshots (not full page), `reducedMotion: reduce`, taken after `networkidle` and `document.fonts.ready`.

| File | URL | Viewport | Language | `dir` / `lang` observed | Size |
| --- | --- | --- | --- | --- | --- |
| [`login-ar-desktop.png`](screens/login-ar-desktop.png) | `/dashboard/login` | desktop 1280x800 | ar | `rtl` / `ar` | 22.7 KB |
| [`merchant-shell-ar-desktop.png`](screens/merchant-shell-ar-desktop.png) | `/dashboard/merchant-shell` | desktop 1280x800 | ar | `rtl` / `ar` | 26.7 KB |
| [`login-en-desktop.png`](screens/login-en-desktop.png) | `/dashboard/login` | desktop 1280x800 | en | `ltr` / `en` | 23.0 KB |
| [`merchant-shell-en-desktop.png`](screens/merchant-shell-en-desktop.png) | `/dashboard/merchant-shell` | desktop 1280x800 | en | `ltr` / `en` | 31.3 KB |
| [`login-ar-mobile.png`](screens/login-ar-mobile.png) | `/dashboard/login` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` | 47.8 KB |
| [`merchant-shell-ar-mobile.png`](screens/merchant-shell-ar-mobile.png) | `/dashboard/merchant-shell` | mobile 390x844, touch, scale 2 | ar | `rtl` / `ar` | 16.5 KB |
| [`login-en-mobile.png`](screens/login-en-mobile.png) | `/dashboard/login` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` | 45.7 KB |
| [`merchant-shell-en-mobile.png`](screens/merchant-shell-en-mobile.png) | `/dashboard/merchant-shell` | mobile 390x844, touch, scale 2 | en | `ltr` / `en` | 16.9 KB |

## Shell page checks (asserted before each shot, the script fails otherwise)

- `document.documentElement.dir` is `rtl` for Arabic and `ltr` for English; `lang` is `ar` / `en`.
- The `merchant-shell-placeholder` marker is present.
- Arabic: the `IBM Plex Sans Arabic` FontFace is `loaded` (5 loaded face(s), 3 loaded face(s)), and the body font family contains it.

## How the language is chosen

- **Dashboard pages:** the user menu → Language dialog (the helpers `loginAsSuperadmin` and `setDisplayLanguage` of
  `apps/server/tests/browser/dashboard-session.ts`). The choice is stored on the server and in the browser's
  `localStorage` key `vendure-user-settings`.
- **Login page:** 3.8.1 has no language picker on the login page and the page does not follow the browser locale. It reads the
  display language persisted in `localStorage` by an earlier in-app switch. The script therefore signs in, switches the language,
  shoots the shell page, signs out (the dashboard's `logout` mutation) and opens `/dashboard/login`, which then renders in the persisted
  language. For a first-time visitor (empty `localStorage`) the login page is always English.
- The login page `dir`/`lang` columns are recorded as observed, not asserted.

## Re-run

```bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-4.sh
```

It uses its own compose project (`cod-evidence`, host ports shifted by 20000), reuses the `${APP_IMAGE:-cod-platform:local}`
image (building it only when absent), and removes the stack and its volumes on exit. It fails if a PNG is over 300 KB, if the
superadmin password or the cookie secret appears in the output folder, or if any assertion above does not hold.
