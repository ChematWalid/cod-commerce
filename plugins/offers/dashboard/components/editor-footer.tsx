import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { EDITOR_DISCARD_TEST_ID, EDITOR_PUBLISH_TEST_ID, EDITOR_SAVE_TEST_ID } from '../constants';

export interface EditorFooterProps {
  /** True for a new offer or a draft: Publish is offered and Save keeps it a draft (D2510). */
  readonly isDraft: boolean;
  /** True when the caller may not save (no create or edit key). */
  readonly disabled: boolean;
  /** False hides Publish: the caller lacks the edit key `publishOffer` asks for. */
  readonly canPublish: boolean;
  readonly busy: boolean;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
  readonly onPublish: () => void;
}

/** Discard / Save as draft / Publish; a live offer saves in place, and Publish shows only to who may publish. */
export function EditorFooter(props: EditorFooterProps): ReactNode {
  const { i18n } = useLingui();
  const blocked = props.disabled || props.busy;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button data-testid={EDITOR_DISCARD_TEST_ID} variant="ghost" disabled={props.busy} onClick={props.onDiscard}>
        {i18n._('offers.editor-discard')}
      </Button>
      <Button
        data-testid={EDITOR_SAVE_TEST_ID}
        variant={props.isDraft ? 'outline' : 'default'}
        disabled={blocked}
        onClick={props.onSave}
      >
        {i18n._(props.isDraft ? 'offers.editor-save-draft' : 'offers.editor-save')}
      </Button>
      {props.isDraft && props.canPublish && (
        <Button data-testid={EDITOR_PUBLISH_TEST_ID} disabled={blocked} onClick={props.onPublish}>
          {i18n._('offers.editor-publish')}
        </Button>
      )}
    </div>
  );
}
