import { useLingui } from '@lingui/react';
import { Input } from '@vendure/dashboard';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useUpdateFlag } from '../hooks/use-flag-mutations';
import { parseRolloutInput } from '../model/rollout-input';
import type { FlagDto } from '../queries';

interface RolloutDraft {
  readonly text: string;
  readonly invalid: boolean;
  readonly setText: (text: string) => void;
  readonly commit: () => void;
}

/** The text being typed, and the save of it once it is a whole percent that differs from what the server holds. */
function useRolloutDraft(flag: FlagDto): RolloutDraft {
  const [text, setText] = useState(String(flag.rolloutPercent));
  const [invalid, setInvalid] = useState(false);
  const lastSent = useRef(flag.rolloutPercent);
  const syncFromServer = (): void => {
    setText(String(flag.rolloutPercent));
    lastSent.current = flag.rolloutPercent;
  };
  const update = useUpdateFlag(flag.key, syncFromServer);
  useEffect(() => {
    syncFromServer();
    setInvalid(false);
  }, [flag.rolloutPercent]);
  // Enter and the blur that follows it commit once: the second sees the value already sent.
  const commit = (): void => {
    const percent = parseRolloutInput(text);
    setInvalid(percent === null);
    if (percent === null || percent === lastSent.current) return;
    lastSent.current = percent;
    update.mutate({ rolloutPercent: percent });
  };
  return { text, invalid, setText, commit };
}

/** The rollout percent, saved when the field loses focus or Enter is pressed. */
export function RolloutField({ flag }: { readonly flag: FlagDto }): ReactNode {
  const { i18n } = useLingui();
  const { text, invalid, setText, commit } = useRolloutDraft(flag);
  return (
    <div className="grid gap-1">
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        className="w-20 text-start"
        data-testid={`flag-rollout-${flag.key}`}
        aria-label={i18n._('flags.rollout-input', { flag: flag.key })}
        aria-invalid={invalid}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      {invalid && <p className="text-destructive text-xs">{i18n._('flags.rollout-invalid')}</p>}
    </div>
  );
}
