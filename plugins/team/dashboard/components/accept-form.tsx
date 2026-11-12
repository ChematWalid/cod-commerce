import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Input, Label, toast } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { type AcceptDraft, acceptInputOf, emptyAcceptDraft } from '../accept-form';
import { SIGN_IN_PATH } from '../constants';
import type { InvitationPreviewDto } from '../dto';
import { acceptErrorMessageId } from '../error-messages';
import { acceptInvitation } from '../invitation-operations';

interface FieldProps {
  readonly labelId: string;
  readonly value: string;
  readonly type?: 'text' | 'password' | 'email';
  readonly autoComplete: string;
  readonly readOnly?: boolean;
  readonly dir?: 'ltr' | 'auto';
  readonly onChange?: (value: string) => void;
}

function Field({ labelId, value, type = 'text', autoComplete, readOnly = false, dir = 'auto', onChange }: FieldProps) {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5 text-start">
      <Label htmlFor={id}>{i18n._(labelId)}</Label>
      <Input
        id={id}
        type={type}
        dir={dir}
        value={value}
        readOnly={readOnly}
        autoComplete={autoComplete}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}

/** Creates the account, then sends the invitee to sign in; the password leaves the page in this one request. */
function useAccept() {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: async () => {
      toast.success(i18n._('team.accept-done'));
      await navigate({ to: SIGN_IN_PATH });
    },
  });
}

interface AcceptFormProps {
  readonly token: string;
  readonly preview: InvitationPreviewDto;
}

interface DraftFieldsProps {
  readonly draft: AcceptDraft;
  readonly onChange: (change: Partial<AcceptDraft>) => void;
}

/** The invitee's names and password; the password is typed into a new-password field and kept in memory only. */
function DraftFields({ draft, onChange }: DraftFieldsProps): ReactNode {
  return (
    <>
      <Field
        labelId="team.accept-first-name"
        value={draft.firstName}
        autoComplete="given-name"
        onChange={(firstName) => {
          onChange({ firstName });
        }}
      />
      <Field
        labelId="team.accept-last-name"
        value={draft.lastName}
        autoComplete="family-name"
        onChange={(lastName) => {
          onChange({ lastName });
        }}
      />
      <Field
        labelId="team.accept-password"
        value={draft.password}
        type="password"
        dir="ltr"
        autoComplete="new-password"
        onChange={(password) => {
          onChange({ password });
        }}
      />
    </>
  );
}

/** The invitee's account form: the invited address and business, read-only, then names and a password. */
export function AcceptForm({ token, preview }: AcceptFormProps): ReactNode {
  const { i18n } = useLingui();
  const [draft, setDraft] = useState<AcceptDraft>(emptyAcceptDraft);
  const accept = useAccept();
  const input = acceptInputOf(token, draft);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (input !== null && !accept.isPending) accept.mutate(input);
      }}
    >
      <h1 className="text-center text-2xl font-semibold tracking-tight">{i18n._('team.accept-title')}</h1>
      <p className="text-muted-foreground text-center text-sm">
        {i18n._('team.accept-intro', { business: preview.businessName })}
      </p>
      <Field labelId="team.accept-business" value={preview.businessName} autoComplete="organization" readOnly />
      <Field labelId="team.field-email" value={preview.email} type="email" dir="ltr" autoComplete="username" readOnly />
      <DraftFields
        draft={draft}
        onChange={(change) => {
          setDraft({ ...draft, ...change });
        }}
      />
      <p className="text-muted-foreground text-xs">{i18n._('team.accept-password-help')}</p>
      {accept.isError && (
        <p role="alert" className="text-destructive text-sm">
          {i18n._(acceptErrorMessageId(accept.error))}
        </p>
      )}
      <Button type="submit" disabled={input === null || accept.isPending}>
        {i18n._('team.accept-submit')}
      </Button>
    </form>
  );
}
