import './styles/rbac.css';
import { registerShellPage } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { activityLogRoute } from './routes/activity-log-page';
import { RolesPage } from './routes/roles-page';

registerShellPage('team.roles', { component: RolesPage });

defineDashboardExtension({
  routes: [activityLogRoute],
});
