import { CATALOG_EDITOR_BLOCK_IDS } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { PageBlock, PageLayout } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { hasOptionVariants } from '../model/editor-form';
import type { OptionsDraft } from '../model/options-draft';
import { DetailsSection } from './details-section';
import { HighlightsField } from './highlights-field';
import { MediaSection } from './media-section';
import { OptionsEditor } from './options-editor';
import { OrganisationSection } from './organisation-section';
import { PricingSection } from './pricing-section';
import type { ScopedSectionProps } from './section-props';
import { SeoSection } from './seo-section';
import { SettingsSection } from './settings-section';
import { VariantsTable } from './variants-table';

export interface EditorBlocksProps extends ScopedSectionProps {
  readonly productId: string | null;
  readonly held: ReadonlySet<string>;
  readonly previews: ReadonlyMap<string, string>;
  readonly warnings: readonly string[];
  readonly optionsChanged: boolean;
}

type Translate = (id: string) => string;
const ids = CATALOG_EDITOR_BLOCK_IDS;

/**
 * The main column: details, media, pricing, options and, once saved with options, the variants. A plain function, not
 * a component: the layout engine only sees `PageBlock`s that are its direct children (or in a fragment).
 */
function mainBlocks(props: EditorBlocksProps, t: Translate): ReactNode[] {
  return [
    <PageBlock key="details" column="main" blockId={ids.details} title={t('catalog.block-details')}>
      <DetailsSection {...props} />
    </PageBlock>,
    <PageBlock key="media" column="main" blockId={ids.media} title={t('catalog.block-media')}>
      <MediaSection {...props} />
    </PageBlock>,
    <PageBlock key="pricing" column="main" blockId={ids.pricing} title={t('catalog.block-pricing')}>
      <PricingSection {...props} />
    </PageBlock>,
    <PageBlock key="options" column="main" blockId={ids.options} title={t('catalog.block-options')}>
      <OptionsEditor
        options={props.form.options}
        error={props.errors.options}
        disabled={props.disabled}
        onChange={(options: OptionsDraft) => {
          props.onChange({ options });
        }}
      />
    </PageBlock>,
    hasOptionVariants(props.form) && (
      <PageBlock key="variants" column="main" blockId={ids.variants} title={t('catalog.block-variants')}>
        <VariantsTable {...props} />
      </PageBlock>
    ),
  ];
}

/** The side column: status and organisation, highlights, settings and SEO. */
function sideBlocks(props: EditorBlocksProps, t: Translate): ReactNode[] {
  return [
    <PageBlock key="organisation" column="side" blockId={ids.organisation} title={t('catalog.block-organisation')}>
      <OrganisationSection {...props} />
    </PageBlock>,
    <PageBlock key="highlights" column="side" blockId={ids.highlights} title={t('catalog.block-highlights')}>
      <HighlightsField {...props} />
    </PageBlock>,
    <PageBlock key="settings" column="side" blockId={ids.settings} title={t('catalog.block-settings')}>
      <SettingsSection {...props} />
    </PageBlock>,
    <PageBlock key="seo" column="side" blockId={ids.seo} title={t('catalog.block-seo')}>
      <SeoSection {...props} />
    </PageBlock>,
  ];
}

/** Every card of the editor, each under its pinned block id so later sessions can add theirs around it (D2105). */
export function EditorBlocks(props: EditorBlocksProps): ReactNode {
  const { i18n } = useLingui();
  const t: Translate = (id) => i18n._(id);
  return (
    <PageLayout>
      {mainBlocks(props, t)}
      {sideBlocks(props, t)}
    </PageLayout>
  );
}
