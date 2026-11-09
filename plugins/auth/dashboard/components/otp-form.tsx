import { OTP_LENGTH, otpSchema } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Input } from '@vendure/dashboard';
import { type SyntheticEvent, type ReactNode, useState } from 'react';
import { verifyEmailOtp } from '../auth-operations';
import { errorMessageId } from '../error-messages';

const OTP_INVALID_MESSAGE_ID = 'auth.otp-invalid';

function useOtpSubmit(
  code: string,
  onVerified: () => void,
): {
  readonly errorId: string | null;
  readonly pending: boolean;
  readonly submit: (event: SyntheticEvent) => void;
} {
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const send = async (): Promise<void> => {
    setPending(true);
    try {
      await verifyEmailOtp(code);
      onVerified();
    } catch (error: unknown) {
      setErrorId(errorMessageId(error));
    } finally {
      setPending(false);
    }
  };
  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (pending) return;
    if (otpSchema.safeParse(code).success) void send();
    else setErrorId(OTP_INVALID_MESSAGE_ID);
  };
  return { errorId, pending, submit };
}

/** Takes the emailed code; the server counts the attempts and decides. */
export function OtpForm({ onVerified }: { readonly onVerified: () => void }): ReactNode {
  const { i18n } = useLingui();
  const [code, setCode] = useState('');
  const { errorId, pending, submit } = useOtpSubmit(code, onVerified);
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={submit} noValidate>
      <Input
        aria-label={i18n._('Verification code')}
        placeholder={i18n._('Verification code')}
        className="w-40"
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {i18n._('Verify')}
      </Button>
      {errorId !== null && (
        <p role="alert" className="text-destructive w-full text-sm">
          {i18n._(errorId)}
        </p>
      )}
    </form>
  );
}
