import { useLingui } from '@lingui/react';
import { PageBlock, PageLayout } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { PreviewState } from '../hooks/use-offer-preview';
import type { StoreScope } from '../queries';
import { ArabicPreview } from './arabic-preview';
import { EditorFooter, type EditorFooterProps } from './editor-footer';
import { kindEditorOf } from './kind-editor-slot';
import { AudienceSection } from './sections/audience-section';
import { ChannelsSection } from './sections/channels-section';
import { CombinesSection } from './sections/combines-section';
import { DatesLimitsSection } from './sections/dates-limits-section';
import { MethodSection } from './sections/method-section';
import { NameSection } from './sections/name-section';
import type { SectionProps } from './sections/section-props';

/** The editor's block ids, so a later session can place its own blocks around them (D2105 practice). */
export const OFFER_EDITOR_BLOCK_IDS = {
  name: 'offers-editor-name',
  kind: 'offers-editor-kind',
  method: 'offers-editor-method',
  audience: 'offers-editor-audience',
  channels: 'offers-editor-channels',
  dates: 'offers-editor-dates',
  combines: 'offers-editor-combines',
  preview: 'offers-editor-preview',
  footer: 'offers-editor-footer',
} as const;

export interface EditorBlocksProps extends SectionProps {
  readonly scope: StoreScope | null;
  readonly preview: PreviewState;
  readonly footer: EditorFooterProps;
}

type Translate = (id: string) => string;
const ids = OFFER_EDITOR_BLOCK_IDS;

/** The kind's own card: its editor from the map by app-type id (D2523), or the buy targets for a kind without one. */
function KindBlock(props: EditorBlocksProps): ReactNode {
  const KindEditor = kindEditorOf(props.form.appTypeId);
  return (
    <KindEditor
      config={props.form.config}
      onConfig={(config) => {
        props.onChange({ config });
      }}
      targets={[...props.form.targets]}
      onTargets={(targets) => {
        props.onChange({ targets });
      }}
      method={props.form.method}
      scope={props.scope}
      disabled={props.disabled}
      targetsErrorId={props.errors.targets}
    />
  );
}

/**
 * The main column: name and headline, the kind's card, then the shared sections. A plain function, not a component:
 * the layout engine only sees `PageBlock`s that are its direct children (or in a fragment).
 */
function mainBlocks(props: EditorBlocksProps, t: Translate): ReactNode[] {
  return [
    <PageBlock key="name" column="main" blockId={ids.name} title={t('offers.block-name')}>
      <NameSection {...props} />
    </PageBlock>,
    <PageBlock key="kind" column="main" blockId={ids.kind} title={t('offers.block-kind')}>
      <KindBlock {...props} />
    </PageBlock>,
    <PageBlock key="method" column="main" blockId={ids.method} title={t('offers.block-method')}>
      <MethodSection {...props} />
    </PageBlock>,
    <PageBlock key="audience" column="main" blockId={ids.audience} title={t('offers.block-audience')}>
      <AudienceSection {...props} />
    </PageBlock>,
    <PageBlock key="channels" column="main" blockId={ids.channels} title={t('offers.block-channels')}>
      <ChannelsSection {...props} />
    </PageBlock>,
    <PageBlock key="dates" column="main" blockId={ids.dates} title={t('offers.block-dates')}>
      <DatesLimitsSection {...props} />
    </PageBlock>,
    <PageBlock key="combines" column="main" blockId={ids.combines} title={t('offers.block-combines')}>
      <CombinesSection {...props} />
    </PageBlock>,
  ];
}

/** Every card of the offer editor, the live Arabic preview beside them and the footer under them. */
export function EditorBlocks(props: EditorBlocksProps): ReactNode {
  const { i18n } = useLingui();
  const t: Translate = (id) => i18n._(id);
  return (
    <PageLayout>
      {mainBlocks(props, t)}
      <PageBlock column="side" blockId={ids.preview} title={t('offers.block-preview')}>
        <ArabicPreview {...props.preview} />
      </PageBlock>
      <PageBlock column="full" blockId={ids.footer} layout="bare">
        <EditorFooter {...props.footer} />
      </PageBlock>
    </PageLayout>
  );
}
