import { defineDashboardExtension } from '@vendure/dashboard';
import { TEMPLATE_NOTES_NAV_ITEM, TEMPLATE_NOTES_PATH } from './constants';
import { NotesPage } from './routes/notes-page';

defineDashboardExtension({
  routes: [{ path: TEMPLATE_NOTES_PATH, component: () => <NotesPage />, navMenuItem: TEMPLATE_NOTES_NAV_ITEM }],
});
