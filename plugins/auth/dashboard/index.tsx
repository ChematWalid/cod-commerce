import { defineDashboardExtension } from '@vendure/dashboard';
import { LoginAfterForm } from './components/login-after-form';
import { VerifyEmailBanner } from './components/verify-email-banner';
import { VERIFY_BANNER_PROVIDER_ID } from './constants';
import { accountProfileRoute } from './routes/account-profile';
import { accountSecurityRoute } from './routes/account-security';
import { confirmEmailChangeRoute } from './routes/confirm-email-change';
import { oauthCompleteRoute } from './routes/oauth-complete';
import { registerRoute } from './routes/register';
import { verifyEmailRoute } from './routes/verify-email';

defineDashboardExtension({
  routes: [
    registerRoute,
    verifyEmailRoute,
    confirmEmailChangeRoute,
    oauthCompleteRoute,
    accountProfileRoute,
    accountSecurityRoute,
  ],
  login: { afterForm: { component: LoginAfterForm } },
  customProviders: [{ id: VERIFY_BANNER_PROVIDER_ID, location: 'layout', component: VerifyEmailBanner }],
});
