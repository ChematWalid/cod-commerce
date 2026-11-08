import { storeCacheTag } from '@cod/shared';
import { cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { storeResolver } from '../../../../src/tenancy/store-resolver-instance';
import { STUB_STORES } from '../../../../src/tenancy/stub-store-resolver';

interface TenantPageParams {
  readonly storeId: string;
  readonly locale: string;
}

interface TenantPageProps {
  readonly params: Promise<TenantPageParams>;
}

interface StoreNameProps {
  readonly storeId: string;
}

/** One prerendered entry per stub store, in its default locale (at least one is required). */
export function generateStaticParams(): TenantPageParams[] {
  return STUB_STORES.map((store) => ({ storeId: store.storeId, locale: store.defaultLocale }));
}

// Cached per store and tagged, so a store publish revalidates exactly its own entries (ADR 0006).
async function StoreName({ storeId }: StoreNameProps): Promise<ReactNode> {
  'use cache';
  cacheTag(storeCacheTag(storeId));
  const store = await storeResolver.findById(storeId);
  if (!store) notFound();
  return <h1 data-testid="store-name">{store.name}</h1>;
}

// params is awaited inside the Suspense boundary: awaiting it at the top of the page fails the build.
async function StoreGreeting({ params }: TenantPageProps): Promise<ReactNode> {
  const { storeId } = await params;
  return <StoreName storeId={storeId} />;
}

/** A store's hello page, reached only through the proxy's rewrite to `/_t/{storeId}/{locale}`. */
export default function TenantPage({ params }: TenantPageProps): ReactNode {
  return (
    <main>
      <Suspense fallback={null}>
        <StoreGreeting params={params} />
      </Suspense>
    </main>
  );
}
