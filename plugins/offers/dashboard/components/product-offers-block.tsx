import { ACTIVE_STORE_ALIAS, storePathFor, useActiveStore } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Link, useParams } from '@tanstack/react-router';
import { Badge, Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import {
  ADD_QUANTITY_OFFER_TEST_ID,
  offerPathOf,
  PRODUCT_OFFER_ROW_TEST_ID,
  PRODUCT_OFFERS_TEST_ID,
} from '../constants';
import { useStoreScope } from '../hooks/use-store-scope';
import {
  newQuantityOfferLinkOf,
  type ProductOfferRow,
  productOffersQueryOf,
  productOffersShown,
  productOffersViewOf,
} from '../model/product-offers';
import { useHeldPermissions, useOffers } from '../queries';
import { BADGE_OF_STATUS } from './offer-table';

interface ListProps {
  readonly storeAlias: string;
  readonly productId: string;
}

function OfferLine({ offer, storeAlias }: { readonly offer: ProductOfferRow; readonly storeAlias: string }) {
  const { i18n } = useLingui();
  return (
    <li data-testid={PRODUCT_OFFER_ROW_TEST_ID} data-offer-id={offer.id} className="grid gap-1">
      <Link
        to={storePathFor(offerPathOf(offer.id), storeAlias)}
        className="font-medium underline-offset-4 [overflow-wrap:anywhere] hover:underline"
      >
        {offer.title}
      </Link>
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{i18n._(offer.kindLabelId)}</span>
        <Badge variant={BADGE_OF_STATUS[offer.status]}>{i18n._(offer.statusLabelId)}</Badge>
      </span>
    </li>
  );
}

function AddQuantityOffer({ storeAlias, productId }: ListProps): ReactNode {
  const { i18n } = useLingui();
  const link = newQuantityOfferLinkOf(productId);
  return (
    <Button
      variant="outline"
      data-testid={ADD_QUANTITY_OFFER_TEST_ID}
      nativeButton={false}
      render={<Link to={storePathFor(link.path, storeAlias)} search={link.search} />}
    >
      {i18n._('offers.product-add-quantity')}
    </Button>
  );
}

/** The saved product's offers: each with its kind and status, a count of the others, and the create link. */
function ProductOffers({ storeAlias, productId }: ListProps): ReactNode {
  const { i18n } = useLingui();
  const scope = useStoreScope(useActiveStore());
  const held = useHeldPermissions(scope);
  const view = productOffersViewOf(productId, useOffers(scope, productOffersQueryOf(productId)), held);
  if (view.kind === 'hidden') return null;
  if (view.kind === 'loading') return <p className="text-sm">{i18n._('offers.loading')}</p>;
  if (view.kind === 'error')
    return (
      <p role="alert" className="text-destructive text-sm">
        {i18n._(view.messageId)}
      </p>
    );
  return (
    <div data-testid={PRODUCT_OFFERS_TEST_ID} className="grid gap-3">
      {view.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{i18n._('offers.product-none')}</p>
      ) : (
        <ul className="grid gap-3">
          {view.rows.map((offer) => (
            <OfferLine key={offer.id} offer={offer} storeAlias={storeAlias} />
          ))}
        </ul>
      )}
      {view.moreCount > 0 && (
        <p className="text-muted-foreground text-sm">{i18n._('offers.product-more', { count: view.moreCount })}</p>
      )}
      {view.canCreate && <AddQuantityOffer storeAlias={storeAlias} productId={productId} />}
    </div>
  );
}

/**
 * The Offers block of catalog's product editor (D2524): lists the offers that target the product and links to a new
 * quantity offer bought on it. Hidden on a new product, and for a member who may not view offers. Presentation only:
 * the server filters and checks everything (ADR 0017).
 */
export function ProductOffersBlock(): ReactNode {
  const params: { readonly productId?: string; readonly storeId?: string } = useParams({ strict: false });
  if (params.productId === undefined) return null;
  return <ProductOffers storeAlias={params.storeId ?? ACTIVE_STORE_ALIAS} productId={params.productId} />;
}

/**
 * The block's `shouldRender` (D2524, D2541): the dashboard calls it on each render of the editor's layout, where hooks
 * may run (Vendure's documented use), so the card is left out on a new product or without `offers.view` instead of
 * showing its title over an empty body.
 */
export function useProductOffersShown(): boolean {
  const params: { readonly productId?: string } = useParams({ strict: false });
  const held = useHeldPermissions(useStoreScope(useActiveStore()));
  return productOffersShown(params.productId, held);
}

/** The block's title, translated. */
export function ProductOffersBlockTitle(): ReactNode {
  const { i18n } = useLingui();
  return i18n._('offers.product-block-title');
}
