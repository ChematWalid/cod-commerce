import { useEffect, useMemo, useState } from 'react';
import type { StoreCollectionRuleDto } from '../dto';
import { type PreviewState, PreviewRequester } from '../model/preview-request';
import { previewRuleOf, type RuleDraft } from '../model/rule-draft';
import { readRequestToken, type StoreScope } from '../model/store-query';
import { fetchPreview } from '../rule-queries';

/**
 * The live preview of the editor's unsaved rule: asked 400 ms after the last change to its complete rows, the latest
 * answer of this store only (D2331, D2160). The rule is compared by content, so an edit of an incomplete row or a
 * re-render asks nothing.
 */
export function usePreviewMatches(scope: StoreScope | null, rule: RuleDraft | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const requester = useMemo(() => new PreviewRequester({ readToken: readRequestToken, fetchPreview }, setState), []);
  const asked = JSON.stringify(previewRuleOf(rule));
  const storeId = scope?.storeId;
  const channelToken = scope?.channelToken;
  useEffect(() => {
    const target = storeId === undefined || channelToken === undefined ? null : { storeId, channelToken };
    requester.request(target, JSON.parse(asked) as StoreCollectionRuleDto | null);
    return () => {
      requester.cancel();
    };
  }, [requester, storeId, channelToken, asked]);
  return state;
}
