# Evidence for P1.S4 (team members and invitations)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S4.sh`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
`99cf831e996c19e8c4ba05275ed00f316bd91fdf`. Compose project `cod-evidence`.

## API transcripts

| File | Shows |
| --- | --- |
| [`api/invite.md`](api/invite.md) | `POST /employees` (all stores, one store, the second store), both invitation mails as Mailpit received them, the hash-only token column |
| [`api/accept.md`](api/accept.md) | Public preview and accept (`no-store`, `no-referrer`), a used link refused on preview and accept, one account |
| [`api/members.md`](api/members.md) | `GET /employees` per tab with counts, search, `GET /employees/:id`, the `teamMembers` query |
| [`api/member-actions.md`](api/member-actions.md) | Edit, limit, stop and resume receiving, order managers, deactivate (no role left) and reactivate, pay, remove |
| [`api/commissions.md`](api/commissions.md) | `GET /commissions/configs/actions` and the configs CRUD, a config in use refused |
| [`api/resend-revoke.md`](api/resend-revoke.md) | Resend (new mail, old link dead), the cooldown refusal, revoke |
| [`api/refusals.md`](api/refusals.md) | Duplicate email, owner remove, self-pay, a double pay answering the first payment, 403 without the permission, anonymous, store reach (D211), 429 on preview, accept and invite |
| [`api/isolation.md`](api/isolation.md) | B's owner on A's member and commission, A's role in B's invite, A on B's store, the same email in both businesses (D201) |

Ids this run acted on (stores, roles, members, commissions, the payment, the business) and channel tokens are placeholders; every
assertion ran on the real values. Invitation tokens and passwords are written `[REDACTED]`; session tokens and cookies never appear.
Administrator ids are the engine's small integers.

`salary.paid` is published on the api process's event bus inside the paying transaction (`plugins/team/infrastructure/salary-paid.event.ts`);
no outbox or subscriber exists until P6.S4, so no worker log line can show it. The database checks in `member-actions.md` and
`refusals.md` show the one booked `salary_payment` row instead.

## Browser suite

Run on this stack, since `browser.yml` does not run on pull requests: `pnpm --filter @cod/server test:browser`.

Test Files  13 passed (13)
Tests  105 passed (105)

## Browser flows proved by `scripts/evidence/P1.S4-screens.mjs`

Every line below is a failing assertion in the script if it does not hold; the shots are in `screens/` (desktop 1440x900, mobile
390x844, Arabic and English).

- ar desktop: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- ar desktop: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- ar desktop: a tab with no member shows the empty-state message.
- ar desktop: the accept page shows the form for an open invitation and its address no longer holds the token.
- ar desktop: the invitation mail (subject "دعوة للانضمام إلى فريق ⁨Demo⁩ على CodShop") renders; its link's token is redacted in the shot.
- ar mobile: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- ar mobile: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- ar mobile: a tab with no member shows the empty-state message.
- ar mobile: the accept page shows the form for an open invitation and its address no longer holds the token.
- ar mobile: the invitation mail (subject "دعوة للانضمام إلى فريق ⁨Demo⁩ على CodShop") renders; its link's token is redacted in the shot.
- en desktop: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- en desktop: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- en desktop: a tab with no member shows the empty-state message.
- en desktop: the accept page shows the form for an open invitation and its address no longer holds the token.
- en desktop: the invitation mail (subject "Join the Demo team on CodShop") renders; its link's token is redacted in the shot.
- en mobile: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- en mobile: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- en mobile: a tab with no member shows the empty-state message.
- en mobile: the accept page shows the form for an open invitation and its address no longer holds the token.
- en mobile: the invitation mail (subject "Join the Demo team on CodShop") renders; its link's token is redacted in the shot.

## What was seen (CLAUDE.md §3a.17, 2026-11-12)

I opened all 44 PNGs, the 11 screens each in Arabic and English, desktop (1440x900) and mobile (390x844), and checked them by eye.

- **Branding:** only our product name appears (CodShop in the mail header, the accept page title and the top bar). The one third-party
  name is the licence notice under the public accept page (ADR 0001), which is allowed.
- **Translation:** no untranslated string in Team's own copy. These stay in English in Arabic because they are data, not interface
  copy: the seeded custom role names ("Demo viewer" and the others), store names ("Demo Store 2"), and names and email addresses.
  Built-in role names are translated (مسؤول الطلبات). Amounts show in local form (32.000 د.ج, 32,000 DZD) and dates as 2026/11/12 or
  Nov 12, 2026.
- **RTL:** in Arabic the sidebar is on the right, the columns run from right to left with the row menu at the inline end, and dialog
  close buttons, check boxes, radio buttons and error lines sit on the right. The tab counts read "(8)" with the number the right way
  round. Email inputs and the link line in the mail stay left-to-right inside right-to-left text.
- **Mobile table:** the first run found the members table wider than its frame at 390 px: 4 px in Arabic and 52 px in English. The
  Pay salary button pushed the row menu out of view. This is fixed in `fix(team): keep the row actions on screen on a phone`: below
  the `md` breakpoint Pay salary moves into the row menu (`actions-menu-*-mobile`). The phone now shows Employee, Salary, Status and
  the menu. Roles, Orders, Store access and Joined are wide-only and appear in View details. The script refuses a shot whose table
  is wider than its frame, and every shot passes.
- **Overflow:** no shot scrolls the page sideways (asserted). Long emails wrap at any character on a phone ("second-store@invitee.e
  xample.test"), which is readable but not pretty.
- **Dialogs:** invite (empty, errors, filled), set limit and pay salary fit both viewports. The invite dialog's role list scrolls
  inside its frame, and Send invitation is disabled until the form is valid.
- **Mail:** the Arabic mail is right-to-left. Both mails show the button and the plain link with the token replaced by
  `[REDACTED_TOKEN]`.

**Not fixed, for the review (Task 18):**

1. The owner's own row offers Pay salary, which the server refuses with `team.self-action` (`refusals.md`). The UI could hide it.
2. Every page shows the "Verify your email" banner, because the seeded owners have not verified their email. This is seed data, not
   Team.
