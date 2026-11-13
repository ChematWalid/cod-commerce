# Evidence for P1.S4 (team members and invitations)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by `scripts/evidence/P1.S4.sh`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
`d5047576d7b685acdaf47a65c4d8eb2330513a31`. Compose project `cod-evidence`.

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
| [`api/graphql.md`](api/graphql.md) | The dashboard's Admin API operations: `inviteMember`, `teamMember`, `updateTeamMember`, `setTeamMemberLimit`, `setTeamMemberReceiving`, `teamOrderManagers`, `deactivateTeamMember`, `reactivateTeamMember`, `payTeamMember`, `removeTeamMember`, the commission queries and mutations, `resendInvitation` (and its cooldown refusal), `revokeInvitation` |

Ids this run acted on (stores, roles, members, commissions, the payment, the business) and channel tokens are placeholders; every
assertion ran on the real values. Invitation tokens and passwords are written `[REDACTED]`; session tokens and cookies never appear.
Administrator ids are the engine's small integers.

`salary.paid` is written to the outbox in the paying transaction (`plugins/team/infrastructure/salary-paid.outbox.ts`, D222);
no consumer subscribes to it until the ledger (P6.S4). The database checks in `refusals.md` show one booked `salary_payment`
row and one `salary.paid` outbox row for the member after the pay and the repeated pay.

## Browser suite

Run on this stack, since `browser.yml` does not run on pull requests: `pnpm --filter @cod/server test:browser`.

Test Files  14 passed (14)
Tests  119 passed (119)

## Browser flows proved by `scripts/evidence/P1.S4-screens.mjs`

Every line below is a failing assertion in the script if it does not hold; the shots are in `screens/` (desktop 1440x900, mobile
390x844, Arabic and English).

- ar desktop: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- ar desktop: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- ar desktop: View details opens the member's read-only details.
- ar desktop: Edit opens the grant and commission fields, and "new commission structure" opens its form.
- ar desktop: Deactivate asks for confirmation and Cancel closes it without a change.
- ar desktop: a tab with no member shows the empty-state message.
- ar desktop: the accept page shows the form for an open invitation and its address no longer holds the token.
- ar desktop: an accept link that opens nothing shows the invalid-link refusal and no form.
- ar desktop: the invitation mail (subject "دعوة للانضمام إلى فريق ⁨Demo⁩ على CodShop") renders; its link's token is redacted in the shot.
- ar mobile: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- ar mobile: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- ar mobile: View details opens the member's read-only details.
- ar mobile: Edit opens the grant and commission fields, and "new commission structure" opens its form.
- ar mobile: Deactivate asks for confirmation and Cancel closes it without a change.
- ar mobile: a tab with no member shows the empty-state message.
- ar mobile: the accept page shows the form for an open invitation and its address no longer holds the token.
- ar mobile: an accept link that opens nothing shows the invalid-link refusal and no form.
- ar mobile: the invitation mail (subject "دعوة للانضمام إلى فريق ⁨Demo⁩ على CodShop") renders; its link's token is redacted in the shot.
- en desktop: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- en desktop: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- en desktop: View details opens the member's read-only details.
- en desktop: Edit opens the grant and commission fields, and "new commission structure" opens its form.
- en desktop: Deactivate asks for confirmation and Cancel closes it without a change.
- en desktop: a tab with no member shows the empty-state message.
- en desktop: the accept page shows the form for an open invitation and its address no longer holds the token.
- en desktop: an accept link that opens nothing shows the invalid-link refusal and no form.
- en desktop: the invitation mail (subject "Join the Demo team on CodShop") renders; its link's token is redacted in the shot.
- en mobile: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.
- en mobile: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.
- en mobile: View details opens the member's read-only details.
- en mobile: Edit opens the grant and commission fields, and "new commission structure" opens its form.
- en mobile: Deactivate asks for confirmation and Cancel closes it without a change.
- en mobile: a tab with no member shows the empty-state message.
- en mobile: the accept page shows the form for an open invitation and its address no longer holds the token.
- en mobile: an accept link that opens nothing shows the invalid-link refusal and no form.
- en mobile: the invitation mail (subject "Join the Demo team on CodShop") renders; its link's token is redacted in the shot.

## What was seen (CLAUDE.md §3a.17, 2026-11-13, evidence at d504757)

I opened all 64 PNGs by eye: 16 screens, each in Arabic and English, at desktop (1440x900) and mobile (390x844).

- **Branding:** only our product name appears (CodShop in the top bar, the mail header and the accept page). The one third-party mark is the Vendure version footer on the public accept page, the licence notice ADR 0001 allows.
- **Untranslated strings:** none in our own copy. In the Arabic screens, the only English is user data: the seeded role names ("Demo viewer", "Demo first store catalog"…), member names and emails, and "Synthetic bonus" typed into the commission form. Built-in roles are translated (مسؤول الطلبات, المالك, المحاسب).
- **RTL:** every Arabic screen mirrors correctly: sidebar on the right, table columns right to left, dialog titles and close buttons swapped, row menus opening toward the content. Names inside Arabic sentences ("تعطيل Amina Saadi؟", "دفع الراتب إلى Amina Saadi") read in the right order. Amounts use the Arabic grouping (32.000) and dates read 2026/11/13.
- **Members list (team-all, team-pending, team-empty):** all four tabs carry counts. The owner's own row offers no Pay salary button: Task 18's self-action fix is visible. Pending rows show "—" for Joined. Business B's Inactive tab shows the empty state. At 390 px the table keeps Employee, Salary, Status and the row menu on screen, and long emails wrap.
- **Row menu (actions-menu):** View details, Edit, Set limit, Stop receiving orders, Deactivate and Remove, with the destructive ones in red. On a phone, Pay salary moves into the menu.
- **Invite (invite-empty, invite-errors, invite-filled):** Email, Roles and Base salary are marked required with "*". The errors are inline and translated. Send stays disabled until the form is valid.
- **Edit and commission inline form (edit, commission-inline):** the Edit dialog keeps the member's roles, store access and salary. The inline "new commission" form opens inside the dialog with Name, Earned on, Type and Value, and its own Cancel and Create buttons.
- **Details (details):** email, status, roles, store access, salary, most open orders, receiving orders and joined date, every label translated.
- **Confirmations (confirm-deactivate, pay-salary, set-limit):** each says what happens in plain words ("loses every role… kept for reactivation"; "recorded once, even if you click twice"; "from 1 to 10000, empty for no limit").
- **Invitation mail (invitation-mail):** CodShop header, inviter and business named, a blue Accept button, the link with its token shown as [REDACTED_TOKEN], and the 7-day validity line. The Arabic version is right-aligned.
- **Accept page (accept-invitation, accept-refusal):** business and email are prefilled and read-only, with the 8-character password hint. A bogus link shows only "This invitation link cannot be used. Ask for a new invitation.", with no business detail (D213).
- **Known, not P1.S4's:** the seeded owners' "Verify your email" banner shows on every dashboard page. It is P1.S2 and the demo seed by design, and is listed in the handoff.
- **Nothing broken:** no clipped text, overflow or overlapping elements at either width.
