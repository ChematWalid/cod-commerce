import { useLingui } from '@lingui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle, Button, toast } from '@vendure/dashboard';
import { type PropsWithChildren, type ReactNode, useEffect, useReducer, useState } from 'react';
import { fetchAccountStatus, resendEmailVerification } from '../auth-operations';
import { ACCOUNT_STATUS_QUERY_KEY, VERIFY_BANNER_TEST_ID } from '../constants';
import { errorMessageId } from '../error-messages';
import { OtpForm } from './otp-form';

const timeOf = (iso: string | null): number => (iso === null ? 0 : Date.parse(iso));

/** Re-renders the moment the resend cooldown ends. */
function useCooldown(serverAvailableAt: string | null): { readonly waiting: boolean; start(iso: string): void } {
  const [localAvailableAt, setLocalAvailableAt] = useState(0);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const until = Math.max(timeOf(serverAvailableAt), localAvailableAt);
  useEffect(() => {
    const remaining = until - Date.now();
    if (remaining <= 0) return undefined;
    const timer = setTimeout(rerender, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [until]);
  return {
    waiting: until > Date.now(),
    start: (iso) => {
      setLocalAvailableAt(timeOf(iso));
    },
  };
}

function ResendButton({ resendAvailableAt }: { readonly resendAvailableAt: string | null }): ReactNode {
  const { i18n } = useLingui();
  const cooldown = useCooldown(resendAvailableAt);
  const [pending, setPending] = useState(false);
  const resend = async (): Promise<void> => {
    setPending(true);
    try {
      cooldown.start(await resendEmailVerification());
      toast.success(i18n._('Verification email sent'));
    } catch (error: unknown) {
      toast.error(i18n._(errorMessageId(error)));
    } finally {
      setPending(false);
    }
  };
  return (
    <Button type="button" variant="outline" disabled={pending || cooldown.waiting} onClick={() => void resend()}>
      {i18n._('Resend email')}
    </Button>
  );
}

function VerifyNotice({ resendAvailableAt }: { readonly resendAvailableAt: string | null }): ReactNode {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  const onVerified = (): void => {
    toast.success(i18n._('Your email is verified'));
    void queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY });
  };
  return (
    <Alert data-testid={VERIFY_BANNER_TEST_ID} className="m-4 w-auto">
      <AlertTitle>{i18n._('Verify your email')}</AlertTitle>
      <AlertDescription>
        <p>{i18n._('We sent you a link and a code. Click the link, or enter the code here.')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <OtpForm onVerified={onVerified} />
          <ResendButton resendAvailableAt={resendAvailableAt} />
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Mounted around every authenticated page; shows only to an account that still has to verify. */
export function VerifyEmailBanner({ children }: PropsWithChildren): ReactNode {
  const { data } = useQuery({ queryKey: ACCOUNT_STATUS_QUERY_KEY, queryFn: fetchAccountStatus, retry: false });
  const mustVerify = data?.verificationRequired === true && !data.emailVerified;
  return (
    <>
      {mustVerify && <VerifyNotice resendAvailableAt={data.resendAvailableAt} />}
      {children}
    </>
  );
}
