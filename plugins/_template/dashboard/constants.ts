/** The route of the notes page, below the dashboard base (`/dashboard`). */
export const TEMPLATE_NOTES_PATH = '/template-notes';

/** Marks the notes page as rendered. */
export const TEMPLATE_NOTES_TEST_ID = 'template-notes-page';

/** The permission that reads notes; `dashboard/` may not import `api/`, where it is defined. */
const READ_TEMPLATE_NOTE_PERMISSION = 'ReadTemplateNote';

/** The nav entry of the notes page, in the dashboard's Catalog section; hidden from users who cannot read notes. */
export const TEMPLATE_NOTES_NAV_ITEM = {
  sectionId: 'catalog',
  id: 'template-notes',
  title: 'Notes',
  requiresPermission: READ_TEMPLATE_NOTE_PERMISSION,
} as const;
