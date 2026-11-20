import type { OfferMethod } from '@cod/shared';
import type { JSX } from 'react';
import type { TargetDraft } from '../model/editor-form';
import type { StoreScope } from '../queries';
import { TargetPicker } from './target-picker';

/** What a kind's editor gets (the contract of Task 14's `KIND_EDITORS`, D2523). */
export interface KindEditorProps {
  readonly config: unknown;
  readonly onConfig: (next: unknown) => void;
  readonly targets: TargetDraft[];
  readonly onTargets: (next: TargetDraft[]) => void;
  readonly method: OfferMethod;
  /** The store the editor is open for, for the editors that search the catalog (targets, add-on products). */
  readonly scope: StoreScope | null;
  readonly disabled: boolean;
  /** The catalogue id of a refused targets field (a publish problem, D2510). */
  readonly targetsErrorId?: string | undefined;
}

/** A kind's own settings card; chosen from a map keyed by app-type id, never a branch per kind (§3a.7). */
export type EditorComponent = (props: KindEditorProps) => JSX.Element;

/**
 * The card of a kind without its own editor: the products it is bought on. Its configuration stays the one it was
 * created or saved with.
 */
export function BuyTargetsEditor(props: KindEditorProps): JSX.Element {
  return (
    <TargetPicker
      scope={props.scope}
      role="buy"
      legendId="offers.editor-targets"
      targets={props.targets}
      onTargets={(next) => {
        props.onTargets([...next]);
      }}
      disabled={props.disabled}
      errorId={props.targetsErrorId}
    />
  );
}

/** The kinds' own editors by app-type id; empty until the per-kind editors land, so every kind uses the fallback. */
export const KIND_EDITORS: Readonly<Partial<Record<string, EditorComponent>>> = {};

/** The editor of `appTypeId`'s card. */
export const kindEditorOf = (appTypeId: string): EditorComponent => KIND_EDITORS[appTypeId] ?? BuyTargetsEditor;
