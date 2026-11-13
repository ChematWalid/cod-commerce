import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { flagErrorMessageId } from '../error-messages';
import { FLAGS_SAVED_MESSAGE_ID } from '../constants';
import {
  type FlagDto,
  type FlagPatch,
  type OverrideInput,
  type OverrideKey,
  removeOverride,
  setOverride,
  updateFlag,
  useReplaceFlag,
} from '../queries';

type Mutation<Variables> = ReturnType<typeof useMutation<FlagDto, unknown, Variables>>;

/** Saves a default or rollout change; the row shows what the server returned, and a refusal is shown in words. */
export function useUpdateFlag(key: string, onFailed?: () => void): Mutation<FlagPatch> {
  const { i18n } = useLingui();
  const replace = useReplaceFlag();
  return useMutation({
    mutationFn: (patch: FlagPatch) => updateFlag(key, patch),
    onSuccess: (flag) => {
      replace(flag);
      toast.success(i18n._(FLAGS_SAVED_MESSAGE_ID));
    },
    onError: (error: unknown) => {
      toast.error(i18n._(flagErrorMessageId(error)));
      onFailed?.();
    },
  });
}

/** Creates or replaces an override. The dialog shows the error itself, so none is toasted. */
export function useSetOverride(onSaved: () => void): Mutation<OverrideInput> {
  const { i18n } = useLingui();
  const replace = useReplaceFlag();
  return useMutation({
    mutationFn: setOverride,
    onSuccess: (flag) => {
      replace(flag);
      toast.success(i18n._(FLAGS_SAVED_MESSAGE_ID));
      onSaved();
    },
  });
}

/** Removes an override. */
export function useRemoveOverride(): Mutation<OverrideKey> {
  const { i18n } = useLingui();
  const replace = useReplaceFlag();
  return useMutation({
    mutationFn: removeOverride,
    onSuccess: (flag) => {
      replace(flag);
      toast.success(i18n._(FLAGS_SAVED_MESSAGE_ID));
    },
    onError: (error: unknown) => {
      toast.error(i18n._(flagErrorMessageId(error)));
    },
  });
}
