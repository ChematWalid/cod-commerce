import './styles/team.css';
import { registerShellPage } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { acceptInvitationRoute } from './routes/accept-invitation-page';
import { TeamMembersPage } from './routes/team-members-page';

// `team.distribution` is not registered: the shell shows its placeholder until P4.S4.
registerShellPage('team.members', { component: TeamMembersPage });

defineDashboardExtension({
  routes: [acceptInvitationRoute],
});
