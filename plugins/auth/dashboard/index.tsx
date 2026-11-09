import { defineDashboardExtension } from '@vendure/dashboard';
import { LoginAfterForm } from './components/login-after-form';
import { VerifyEmailBanner } from './components/verify-email-banner';
import { ACCOUNT_NAV_SECTION_ID, ACCOUNT_NAV_SECTION_ORDER, VERIFY_BANNER_PROVIDER_ID } from './constants';
import { accountProfileRoute } from './routes/account-profile';
import { accountSecurityRoute } from './routes/account-security';
import { confirmEmailChangeRoute } from './routes/confirm-email-change';
import { registerRoute } from './routes/register';
import { verifyEmailRoute } from './routes/verify-email';

defineDashboardExtension({
  routes: [registerRoute, verifyEmailRoute, confirmEmailChangeRoute, accountProfileRoute, accountSecurityRoute],
  login: { afterForm: { component: LoginAfterForm } },
  customProviders: [{ id: VERIFY_BANNER_PROVIDER_ID, location: 'layout', component: VerifyEmailBanner }],
  navSections: [
    { id: ACCOUNT_NAV_SECTION_ID, title: 'Account', placement: 'bottom', order: ACCOUNT_NAV_SECTION_ORDER },
  ],
});
