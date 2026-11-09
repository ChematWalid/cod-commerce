import { useLingui } from '@lingui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useRef, useState } from 'react';
import { ACCOUNT_STATUS_QUERY_KEY, HOME_PATH } from '../constants';
import { errorMessageId } from '../error-messages';

interface TokenConfirmCardProps {
  readonly token: string | undefined;
  readonly title: string;
  readonly explanation: string;
  readonly actionLabel: string;
  readonly successMessage: string;
  readonly confirm: (token: string) => Promise<void>;
}

const INVALID_TOKEN_MESSAGE_ID = 'auth.invalid-token';

type Outcome = { readonly kind: 'idle' | 'pending' | 'done' } | { readonly kind: 'failed'; readonly messageId: string };

function useTokenAction(
  token: string | undefined,
  confirm: (token: string) => Promise<void>,
): {
  readonly outcome: Outcome;
  readonly run: () => void;
} {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const inFlight = useRef(false);
  const spend = async (spendable: string): Promise<void> => {
    inFlight.current = true;
    setOutcome({ kind: 'pending' });
    try {
      await confirm(spendable);
      setOutcome({ kind: 'done' });
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY });
    } catch (error: unknown) {
      setOutcome({ kind: 'failed', messageId: errorMessageId(error) });
    } finally {
      inFlight.current = false;
    }
  };
  return {
    outcome,
    run: () => {
      if (token !== undefined && !inFlight.current) void spend(token);
    },
  };
}

function errorIdOf(token: string | undefined, outcome: Outcome): string | null {
  if (token === undefined) return INVALID_TOKEN_MESSAGE_ID;
  return outcome.kind === 'failed' ? outcome.messageId : null;
}

/**
 * Spends an emailed token only when the person clicks. Mail scanners fetch links and some run scripts, so neither
 * the GET nor the page's load may spend it. The ref keeps a double click to one request.
 */
export function TokenConfirmCard(props: TokenConfirmCardProps): ReactNode {
  const { token, title, explanation, actionLabel, successMessage, confirm } = props;
  const { i18n } = useLingui();
  const { outcome, run } = useTokenAction(token, confirm);
  if (outcome.kind === 'done') return <Finished message={successMessage} />;
  const errorId = errorIdOf(token, outcome);
  return (
    <div className="grid gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{explanation}</p>
      {errorId !== null && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(errorId)}
        </p>
      )}
      <Button type="button" disabled={token === undefined || outcome.kind === 'pending'} onClick={run}>
        {actionLabel}
      </Button>
    </div>
  );
}

function Finished({ message }: { readonly message: string }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 text-center">
      <p role="status">{message}</p>
      <Button nativeButton={false} render={<Link to={HOME_PATH} />}>
        {i18n._('Go to dashboard')}
      </Button>
    </div>
  );
}
