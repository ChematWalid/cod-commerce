import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';

/** A field's translated refusal, or nothing. */
export function FieldError({ messageId }: { readonly messageId: string | undefined }): ReactNode {
  const { i18n } = useLingui();
  if (messageId === undefined) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {i18n._(messageId)}
    </p>
  );
}
