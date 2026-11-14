/**
 * The route the notes page had, below the dashboard base (`/dashboard`). The route was removed in P2.S1 (D2111, TPL-2):
 * kept for the retired evidence script `scripts/evidence/template-screens.mjs`.
 */
export const TEMPLATE_NOTES_PATH = '/template-notes';

/** Marks the notes page as rendered. */
export const TEMPLATE_NOTES_TEST_ID = 'template-notes-page';

/** How many notes the page asks for: the API's default page size, which `dashboard/` may not import from `domain/` (D92). */
export const TEMPLATE_NOTES_PAGE_SIZE = 20;

/** The notes page's title, a message id of `i18n/*.po`. */
export const TEMPLATE_NOTES_TITLE = 'Notes';
