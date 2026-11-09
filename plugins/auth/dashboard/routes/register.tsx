import { useLingui } from '@lingui/react';
import type { AnyRoute } from '@tanstack/react-router';
import { Link, Navigate } from '@tanstack/react-router';
import { type DashboardRouteDefinition, useAuth } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PublicPageFrame } from '../components/public-page-frame';
import { RegisterStepAccount } from '../components/register-step-account';
import { RegisterStepBusiness } from '../components/register-step-business';
import { RegisterStepStore } from '../components/register-step-store';
import { HOME_PATH, INVALID_TICKET_MESSAGE_ID, LOGIN_PATH, REGISTER_FORM_TEST_ID, REGISTER_PATH } from '../constants';
import { type OAuthPrefill, useOAuthPrefill } from '../hooks/use-oauth-prefill';
import { type NavigateTo, useFinishRegistration } from '../hooks/use-finish-registration';
import { type RegisterWizard, useRegisterWizard, WIZARD_STEPS, type WizardStep } from '../hooks/use-register-wizard';
import { useRawSearch, validateTicketSearch } from './token-search';

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

interface WizardBodyProps {
  readonly wizard: RegisterWizard;
  readonly ticket: string | undefined;
  readonly prefill: OAuthPrefill;
}

function WizardBody({ wizard, ticket, prefill }: WizardBodyProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      {prefill.invalid && (
        <p role="alert" className="text-destructive text-center text-sm">
          {i18n._(INVALID_TICKET_MESSAGE_ID)}
        </p>
      )}
      {wizard.step === 'account' && (
        <RegisterStepAccount wizard={wizard} oauth={ticket === undefined ? undefined : prefill} />
      )}
      {wizard.step === 'business' && <RegisterStepBusiness wizard={wizard} />}
      {wizard.step === 'store' && <RegisterStepStore wizard={wizard} />}
    </>
  );
}

function RegisterPage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const auth = useAuth();
  const navigate: NavigateTo = route.useNavigate();
  const { created, finish } = useFinishRegistration(navigate);
  const { ticket } = validateTicketSearch(useRawSearch(route));
  const wizard = useRegisterWizard(finish, ticket);
  const prefill = useOAuthPrefill(ticket, wizard.set);
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
        <WizardBody wizard={wizard} ticket={ticket} prefill={prefill} />
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
  validateSearch: validateTicketSearch,
  component: (route) => <RegisterPage route={route} />,
};
