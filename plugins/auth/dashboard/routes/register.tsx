import { useLingui } from '@lingui/react';
import type { AnyRoute } from '@tanstack/react-router';
import { Link, Navigate } from '@tanstack/react-router';
import { type DashboardRouteDefinition, toast, useAuth } from '@vendure/dashboard';
import { type ReactNode, useEffect, useState } from 'react';
import { type RegisterMerchantResultDto, saveBusinessLogo } from '../auth-operations';
import { PublicPageFrame } from '../components/public-page-frame';
import { RegisterStepAccount } from '../components/register-step-account';
import { RegisterStepBusiness } from '../components/register-step-business';
import { RegisterStepStore } from '../components/register-step-store';
import {
  HOME_PATH,
  IMAGE_SAVE_FAILED_MESSAGE_ID,
  LOGIN_PATH,
  REGISTER_FORM_TEST_ID,
  REGISTER_PATH,
  SIGN_IN_AFTER_REGISTER_MESSAGE_ID,
} from '../constants';
import { useRegisterWizard, WIZARD_STEPS, type WizardStep, type WizardValues } from '../hooks/use-register-wizard';

type NavigateTo = (options: { readonly to: string }) => unknown;

function StepIndicator({ step }: { readonly step: WizardStep }): ReactNode {
  const { i18n } = useLingui();
  const current = WIZARD_STEPS.indexOf(step) + 1;
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-center text-xs">
        {i18n._('Step {current} of {total}', { current, total: WIZARD_STEPS.length })}
      </p>
      <div className="flex gap-1" aria-hidden>
        {WIZARD_STEPS.map((name, index) => (
          <span key={name} className={`h-1 flex-1 rounded-full ${index < current ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * True from the created account until the login and logo are done. Module state on purpose: the dashboard unmounts
 * its router while `auth.status` is `verifying`, so component state would be lost mid-login and the fresh page would
 * redirect Home before the logo is saved, or show an empty wizard if the login failed.
 */
const finishing = { active: false };

/**
 * Logs the new account in and finishes the sign-up. The account exists from here on, so a logo problem only
 * warns (D34), and a failed login sends the merchant to sign in rather than back into a form that would refuse.
 */
function useFinishRegistration(navigate: NavigateTo): {
  readonly created: boolean;
  readonly finish: (result: RegisterMerchantResultDto, values: WizardValues) => void;
} {
  const { i18n } = useLingui();
  const auth = useAuth();
  const [created, setCreated] = useState(finishing.active);
  useEffect(() => {
    if (!finishing.active || auth.status !== 'unauthenticated') return;
    finishing.active = false;
    toast.error(i18n._(SIGN_IN_AFTER_REGISTER_MESSAGE_ID));
    void navigate({ to: LOGIN_PATH });
  }, [auth.status, i18n, navigate]);
  const finish = ({ storeId }: RegisterMerchantResultDto, { email, password, logo }: WizardValues): void => {
    finishing.active = true;
    setCreated(true);
    auth.login(email, password, () => {
      const saved = logo === null ? Promise.resolve() : saveBusinessLogo(logo, storeId);
      void saved
        .catch(() => toast.error(i18n._(IMAGE_SAVE_FAILED_MESSAGE_ID)))
        .finally(() => {
          finishing.active = false;
          void navigate({ to: HOME_PATH });
        });
    });
  };
  return { created, finish };
}

function RegisterPage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const auth = useAuth();
  const navigate: NavigateTo = route.useNavigate();
  const { created, finish } = useFinishRegistration(navigate);
  const wizard = useRegisterWizard(finish);
  const titles: Readonly<Record<WizardStep, string>> = {
    account: i18n._('Create your account'),
    business: i18n._('Your business'),
    store: i18n._('Set up your store'),
  };
  if (created)
    return (
      <PublicPageFrame>
        <p role="status" className="text-center">
          {i18n._('Creating your store…')}
        </p>
      </PublicPageFrame>
    );
  if (auth.isAuthenticated) return <Navigate to={HOME_PATH} />;
  return (
    <PublicPageFrame>
      <div className="grid gap-6" data-testid={REGISTER_FORM_TEST_ID}>
        <h1 className="text-center text-2xl font-semibold tracking-tight">{titles[wizard.step]}</h1>
        <StepIndicator step={wizard.step} />
        {wizard.step === 'account' && <RegisterStepAccount wizard={wizard} />}
        {wizard.step === 'business' && <RegisterStepBusiness wizard={wizard} />}
        {wizard.step === 'store' && <RegisterStepStore wizard={wizard} />}
        <p className="text-muted-foreground text-center text-sm">
          {i18n._('Already have an account?')}{' '}
          <Link to={LOGIN_PATH} className="text-foreground font-medium underline">
            {i18n._('Sign in')}
          </Link>
        </p>
      </div>
    </PublicPageFrame>
  );
}

/** The 3-step sign-up, reachable without a session (D20). */
export const registerRoute: DashboardRouteDefinition = {
  path: REGISTER_PATH,
  authenticated: false,
  component: (route) => <RegisterPage route={route} />,
};
