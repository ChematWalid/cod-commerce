import { useLingui } from '@lingui/react';
import { PageBlock, PageLayout } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { COLLECTION_EDITOR_BLOCK_IDS as ids } from '../constants';
import type { StoreCollectionImageDto } from '../dto';
import type { ScopedCardProps } from './card-props';
import { DetailsCard } from './details-card';
import { ImageCard } from './image-card';
import { ManualProductsCard } from './manual-products-card';
import { PositionCard, VisibilityCard } from './visibility-card';

export interface EditorBlocksProps extends ScopedCardProps {
  readonly held: ReadonlySet<string>;
  readonly savedImage: StoreCollectionImageDto | null;
}

/**
 * Every card of the editor: details and products in the main column, image, visibility and position in the side one.
 * The layout engine only sees `PageBlock`s that are its direct children, so they are listed here.
 */
export function EditorBlocks(props: EditorBlocksProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <PageLayout>
      <PageBlock column="main" blockId={ids.details} title={i18n._('collections.block-details')}>
        <DetailsCard {...props} />
      </PageBlock>
      <PageBlock column="main" blockId={ids.products} title={i18n._('collections.block-products')}>
        <ManualProductsCard {...props} />
      </PageBlock>
      <PageBlock column="side" blockId={ids.image} title={i18n._('collections.block-image')}>
        <ImageCard {...props} />
      </PageBlock>
      <PageBlock column="side" blockId={ids.visibility} title={i18n._('collections.block-visibility')}>
        <VisibilityCard {...props} />
      </PageBlock>
      <PageBlock column="side" blockId={ids.organisation} title={i18n._('collections.block-organisation')}>
        <PositionCard {...props} />
      </PageBlock>
    </PageLayout>
  );
}
