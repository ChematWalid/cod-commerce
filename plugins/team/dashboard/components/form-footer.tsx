import { useLingui } from '@lingui/react';
import { Button, DialogFooter } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { CANCEL_MESSAGE_ID } from '../constants';
import { errorMessageId } from '../error-messages';

interface FormFooterProps {
  readonly submitId: string;
  /** Disabled while the form has gaps or a request is in flight. */
  readonly disabled: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

/** A dialog's Cancel and submit buttons. */
export function FormFooter({ submitId, disabled, onSubmit, onCancel }: FormFooterProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        {i18n._(CANCEL_MESSAGE_ID)}
      </Button>
      <Button type="button" disabled={disabled} onClick={onSubmit}>
        {i18n._(submitId)}
      </Button>
    </DialogFooter>
  );
}

/** The translated refusal of a request, or nothing. */
export function ErrorAlert({ error }: { readonly error: unknown }): ReactNode {
  const { i18n } = useLingui();
  if (error === null || error === undefined) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {i18n._(errorMessageId(error))}
    </p>
  );
}
