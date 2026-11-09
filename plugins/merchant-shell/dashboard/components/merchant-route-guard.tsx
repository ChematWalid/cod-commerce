import { useMatches, useNavigate } from '@tanstack/react-router';
import { ErrorPage, extensionRoutes } from '@vendure/dashboard';
import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import { MERCHANT_NOT_FOUND_TEST_ID } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';
import { decideMerchantRoute, MERCHANT_ALLOWED_STOCK_ROUTES } from '../model/route-decision';

/** The not-found page of the shell, for a URL outside it or a store the caller cannot reach. */
export function MerchantNotFound(): ReactNode {
  return (
    <div data-testid={MERCHANT_NOT_FOUND_TEST_ID} className="contents">
      <ErrorPage kind="not-found" />
    </div>
  );
}

/**
 * Navigates once. The router's `<Navigate>` navigates again whenever its props object changes, so under this guard,
 * which re-renders while the navigation loads, it would loop for as long as the page is open.
 */
function RedirectTo({ to }: { readonly to: string }): ReactNode {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to, replace: true });
  }, [navigate, to]);
  return null;
}

/**
 * Keeps merchants on the shell's own pages (D84). Decides on the last match's `routeId`, because `fullPath` is `/` for
 * both the index and an unknown URL. Nothing renders until the audience is known, so no stock page flashes.
 * Presentation only: the server refuses stock data to merchants whatever this shows (D59).
 */
export function MerchantRouteGuard({ children }: PropsWithChildren): ReactNode {
  const audience = useShellAudience();
  const routeId = (useMatches().at(-1)?.routeId as string | undefined) ?? '';
  if (audience === 'pending') return null;
  if (audience === 'staff') return children;
  const decision = decideMerchantRoute(routeId, [...extensionRoutes.keys()], MERCHANT_ALLOWED_STOCK_ROUTES);
  if (decision === 'render') return children;
  if (decision === 'not-found') return <MerchantNotFound />;
  return <RedirectTo to={decision.redirect} />;
}
