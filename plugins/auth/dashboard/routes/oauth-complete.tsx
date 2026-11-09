import { useLingui } from '@lingui/react';
import type { AnyRoute } from '@tanstack/react-router';
import { Link, Navigate } from '@tanstack/react-router';
import { type DashboardRouteDefinition, useAuth } from '@vendure/dashboard';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { PublicPageFrame } from '../components/public-page-frame';
import { HOME_PATH, LOGIN_PATH, OAUTH_COMPLETE_PATH } from '../constants';
import { errorMessageId, messageIdOfCode } from '../error-messages';
import { useOAuthSignIn } from '../hooks/use-oauth-sign-in';
import { useRawSearch } from './token-search';

/** What the callback redirected with: a ticket to spend, or the code of a refusal. */
interface OAuthCompleteSearch {
  readonly ticket: string | undefined;
  readonly error: string | undefined;
}

function validateSearch(search: Record<string, unknown>): OAuthCompleteSearch {
  const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
  return { ticket: text(search['ticket']), error: text(search['error']) };
}

function Refusal({ messageId }: { readonly messageId: string }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 text-center">
      <p role="alert">{i18n._(messageId)}</p>
      <Link to={LOGIN_PATH} className="text-foreground text-sm font-medium underline">
        {i18n._('Back to sign in')}
      </Link>
    </div>
  );
}

function OAuthCompletePage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const auth = useAuth();
  const signIn = useOAuthSignIn();
  const { ticket, error } = validateSearch(useRawSearch(route));
  const [failure, setFailure] = useState(() => (error === undefined ? undefined : messageIdOfCode(error)));
  const [signedIn, setSignedIn] = useState(false);
  // The ticket works once, and the effect runs twice under React's strict mode.
  const spent = useRef(false);
  useEffect(() => {
    if (ticket === undefined || error !== undefined || spent.current) return;
    spent.current = true;
    signIn(ticket)
      .then(() => {
        setSignedIn(true);
      })
      .catch((reason: unknown) => {
        setFailure(errorMessageId(reason));
      });
  }, [ticket, error, signIn]);
  if (signedIn && auth.isAuthenticated) return <Navigate to={HOME_PATH} />;
  return (
    <PublicPageFrame>
      {failure === undefined && ticket !== undefined ? (
        <p role="status" className="text-center">
          {i18n._('Signing you in…')}
        </p>
      ) : (
        <Refusal messageId={failure ?? messageIdOfCode('')} />
      )}
    </PublicPageFrame>
  );
}

/** Where a provider sign-in lands: spends the ticket, then goes Home (D36). */
export const oauthCompleteRoute: DashboardRouteDefinition = {
  path: OAUTH_COMPLETE_PATH,
  authenticated: false,
  validateSearch,
  component: (route) => <OAuthCompletePage route={route} />,
};
