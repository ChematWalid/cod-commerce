import { PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { type ReactNode, Suspense } from 'react';
import { PRERENDER_SENTINEL_STORE_ID } from '../../../../../src/tenancy/store-resolver';
import { PRERENDER_SENTINEL_BINDING } from '../../../../../src/tenancy/tenant-verifier-instance';
import type { TenantRouteParams } from '../../../../../src/tenancy/verified-tenant';
import { TenantGate } from '../../../../../src/views/tenant-gate';

interface TenantLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<TenantRouteParams>;
}

/**
 * Next requires at least one entry, with the root `locale` param named too; real stores are rendered on demand and
 * cached by tag.
 */
export function generateStaticParams(): TenantRouteParams[] {
  return PLATFORM_LANGUAGE_CODES.map((locale) => ({
    locale,
    storeId: PRERENDER_SENTINEL_STORE_ID,
    binding: PRERENDER_SENTINEL_BINDING,
  }));
}

/**
 * The binding gate of every store page. A path that slipped past the proxy (`/_t/…/<B>/<x>`) needs B's binding,
 * which only the proxy produces on B's own host; anything else renders the not-found UI and no store data. Pages
 * run the same check themselves to get the `VerifiedTenant` their loaders take. params are awaited inside the
 * Suspense boundary: awaiting them at the top of the layout fails the build.
 */
export default function TenantLayout({ children, params }: TenantLayoutProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <TenantGate params={params}>{children}</TenantGate>
    </Suspense>
  );
}
