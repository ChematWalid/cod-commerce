import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import type { RawQuery } from '../../../../../../../src/catalog/listing-query';
import { collectionPageMetadata, tenantMetadata } from '../../../../../../../src/seo/metadata';
import { type CollectionRouteParams, CollectionContent } from '../../../../../../../src/views/listing-pages';

interface CollectionPageProps {
  readonly params: Promise<CollectionRouteParams>;
  readonly searchParams: Promise<RawQuery>;
}

export function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant, route) => collectionPageMetadata(tenant, route.slug));
}

/** A collection and its listed products, paged and sorted like the product list. */
export default function CollectionPage({ params, searchParams }: CollectionPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <CollectionContent params={params} query={searchParams} />
    </Suspense>
  );
}
