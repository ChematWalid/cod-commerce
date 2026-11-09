import './styles/rbac.css';
import { defineDashboardExtension } from '@vendure/dashboard';
import { TEAM_NAV_SECTION_ID, TEAM_NAV_SECTION_ORDER, TEAM_NAV_SECTION_TITLE } from './constants';
import { activityLogRoute } from './routes/activity-log-page';
import { rolesRoute } from './routes/roles-page';

defineDashboardExtension({
  routes: [rolesRoute, activityLogRoute],
  navSections: [{ id: TEAM_NAV_SECTION_ID, title: TEAM_NAV_SECTION_TITLE, order: TEAM_NAV_SECTION_ORDER }],
});
