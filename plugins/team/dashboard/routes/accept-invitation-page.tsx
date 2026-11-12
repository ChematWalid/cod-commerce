import { TEAM_ERROR_CODES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useQuery } from '@tanstack/react-query';
import type { AnyRoute } from '@tanstack/react-router';
import type { DashboardRouteDefinition } from '@vendure/dashboard';
import { type ReactNode, useEffect, useState } from 'react';
import { AcceptForm } from '../components/accept-form';
import { PublicFrame } from '../components/public-frame';
import {
  ACCEPT_INVITATION_PATH,
  ACCEPT_PAGE_TEST_ID,
  INVITATION_PREVIEW_QUERY_KEY,
  LOADING_MESSAGE_ID,
} from '../constants';
import { acceptErrorMessageId } from '../error-messages';
import { previewInvitation } from '../invitation-operations';

/** The `?token=` of an invitation link. */
function validateTokenSearch(search: Record<string, unknown>): { readonly token: string | undefined } {
  return { token: typeof search['token'] === 'string' && search['token'] !== '' ? search['token'] : undefined };
}

/**
 * The link's token, read once, and the address bar cleared of it straight away (D205): it stays out of history,
 * bookmarks, screenshots and any later `Referer`.
 */
function useLinkTokenOnce(route: AnyRoute): string | undefined {
  const search: unknown = route.useSearch();
  const [token] = useState(() => validateTokenSearch(search as Record<string, unknown>).token);
  useEffect(() => {
    if (window.location.search !== '') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);
  return token;
}

function Refusal({ messageId }: { readonly messageId: string }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{i18n._('team.accept-title')}</h1>
      <p role="alert" className="text-destructive text-sm">
        {i18n._(messageId)}
      </p>
    </div>
  );
}

function AcceptInvitationPage({ route }: { readonly route: AnyRoute }): ReactNode {
  const { i18n } = useLingui();
  const token = useLinkTokenOnce(route);
  const preview = useQuery({
    queryKey: INVITATION_PREVIEW_QUERY_KEY,
    queryFn: () => previewInvitation(token ?? ''),
    enabled: token !== undefined,
    retry: false,
    staleTime: Infinity,
  });
  const body = (): ReactNode => {
    if (token === undefined) return <Refusal messageId={TEAM_ERROR_CODES.INVITATION_INVALID} />;
    if (preview.isError) return <Refusal messageId={acceptErrorMessageId(preview.error)} />;
    if (!preview.isSuccess) return <p className="text-center">{i18n._(LOADING_MESSAGE_ID)}</p>;
    return <AcceptForm token={token} preview={preview.data} />;
  };
  return (
    <PublicFrame>
      <div data-testid={ACCEPT_PAGE_TEST_ID}>{body()}</div>
    </PublicFrame>
  );
}

/** The page an invitation email links to; public, since the invitee has no account yet. */
export const acceptInvitationRoute: DashboardRouteDefinition = {
  path: ACCEPT_INVITATION_PATH,
  authenticated: false,
  validateSearch: validateTokenSearch,
  component: (route) => <AcceptInvitationPage route={route} />,
};
