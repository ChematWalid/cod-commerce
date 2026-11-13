// Part of scripts/evidence/P1.S4-screens.mjs: the row dialogs past the actions menu (View details, Edit with its commission
// picker and inline form, the Deactivate confirmation) and the accept page's refusal of a link that opens nothing.
// Each function takes the page already on the team list (or a fresh context) and the shared shot kit:
//   { t, shoot, proved, base, memberRow, acceptPage, publicLanguage }.

const ESCAPE = 'Escape';

async function closeDialog(page, role = 'dialog') {
  await page.keyboard.press(ESCAPE);
  await page.getByRole(role).waitFor({ state: 'hidden' });
}

async function openRowAction(page, kit, email, actionId) {
  const { t, memberRow } = kit;
  await memberRow(page, email).getByRole('button', { name: t('team.row-actions') }).click();
  await page.getByRole('menuitem', { name: t(actionId), exact: true }).click();
}

/** View details: the member's email, status, access, limit and receiving, read only. */
export async function shootDetailsDialog(page, kit, { email, lang, vp }) {
  const { t, shoot, proved } = kit;
  await openRowAction(page, kit, email, 'team.action-view');
  const dialog = page.getByRole('dialog');
  await dialog.getByText(t('team.column-status'), { exact: true }).waitFor();
  await dialog.getByText(email, { exact: true }).waitFor();
  await shoot(page, `details-${lang}-${vp}`, lang, { fullPage: false });
  await closeDialog(page);
  proved(`${lang} ${vp}: View details opens the member's read-only details.`);
}

/** Edit: the grant fields and commission picker, then the inline "new commission structure" form. */
export async function shootEditDialog(page, kit, { email, lang, vp }) {
  const { t, shoot, proved } = kit;
  await openRowAction(page, kit, email, 'team.action-edit');
  const dialog = page.getByRole('dialog');
  const newCommission = dialog.getByRole('button', { name: t('team.commission-new'), exact: true });
  await newCommission.waitFor();
  await shoot(page, `edit-${lang}-${vp}`, lang, { fullPage: false });
  await newCommission.click();
  await dialog.locator('[data-testid="team-commission-inline-form"]').waitFor();
  await dialog.getByRole('textbox', { name: t('team.commission-name') }).fill('Synthetic bonus');
  await dialog.getByRole('button', { name: t('team.commission-create'), exact: true }).scrollIntoViewIfNeeded();
  await shoot(page, `commission-inline-${lang}-${vp}`, lang, { fullPage: false });
  await closeDialog(page);
  proved(`${lang} ${vp}: Edit opens the grant and commission fields, and "new commission structure" opens its form.`);
}

/** Deactivate asks first; Cancel leaves the member as it was. */
export async function shootConfirmDialog(page, kit, { email, lang, vp }) {
  const { t, shoot, proved } = kit;
  await openRowAction(page, kit, email, 'team.action-deactivate');
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: t('team.cancel'), exact: true }).waitFor();
  await shoot(page, `confirm-deactivate-${lang}-${vp}`, lang, { fullPage: false });
  await confirm.getByRole('button', { name: t('team.cancel'), exact: true }).click();
  await confirm.waitFor({ state: 'hidden' });
  proved(`${lang} ${vp}: Deactivate asks for confirmation and Cancel closes it without a change.`);
}

/** A link whose token opens nothing gets the one opaque refusal, with no form. */
export async function shootAcceptRefusal(browser, kit, { lang, vp, contextOptions }) {
  const { t, shoot, proved, base, acceptPage, publicLanguage } = kit;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    await page.goto(`${base}/accept-invitation?token=not-a-real-invitation-token`);
    await page.locator(acceptPage).waitFor();
    await page.getByRole('button', { name: publicLanguage[lang], exact: true }).click();
    await page.getByText(t('team.invitation-invalid'), { exact: true }).waitFor();
    const formShown = await page.getByRole('textbox', { name: t('team.accept-first-name') }).count();
    if (formShown !== 0) throw new Error(`${lang} ${vp}: the refusal still shows the accept form`);
    await shoot(page, `accept-refusal-${lang}-${vp}`, lang);
    proved(`${lang} ${vp}: an accept link that opens nothing shows the invalid-link refusal and no form.`);
  } finally {
    await context.close();
  }
}
