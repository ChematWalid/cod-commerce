import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { CODE_MAX_LENGTH, GENERATED_CODE_PREFIX_MAX, type GenerateCodesInput } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, toast } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { addOfferCode, generateOfferCodes, type OfferCodeDto, removeOfferCode, useOfferCodes } from '../codes-queries';
import { CODES_PANEL_TEST_ID } from '../constants';
import { useCodeCommand } from '../hooks/use-code-command';
import { type CodeInput, codeInputOf, generateInputOf } from '../model/code-inputs';
import { formatWhole } from '../model/list-view';
import type { StoreScope } from '../queries';
import { LtrRun } from './ltr-run';

export interface CodesPanelProps {
  readonly scope: StoreScope | null;
  /** The saved offer, or null for a new one: codes are added to a saved draft. */
  readonly offerId: string | null;
  readonly disabled: boolean;
}

interface SavedPanelProps extends CodesPanelProps {
  readonly offerId: string;
}

interface CodeRowProps {
  readonly code: OfferCodeDto;
  readonly onRemove: () => void;
  readonly disabled: boolean;
}

function CodeRow({ code, onRemove, disabled }: CodeRowProps): ReactNode {
  const { i18n } = useLingui();
  const count = formatWhole(code.usageCount, i18n.locale);
  const usage =
    code.usageLimit === null
      ? i18n._('offers.codes-usage-unlimited', { count })
      : i18n._('offers.codes-usage', { count, limit: formatWhole(code.usageLimit, i18n.locale) });
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-3">
        <LtrRun>{code.code}</LtrRun>
        <span className="text-muted-foreground">{usage}</span>
      </span>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
        {i18n._('offers.codes-remove')}
      </Button>
    </li>
  );
}

function CodeList({ scope, offerId, disabled }: SavedPanelProps): ReactNode {
  const { i18n } = useLingui();
  const codes = useOfferCodes(scope, offerId);
  const remove = useCodeCommand((code: string) => removeOfferCode(scope, offerId, code), 'offers.codes-removed');
  if (codes.isError) return <p role="alert">{i18n._('offers.error-generic')}</p>;
  if (codes.data === undefined) return <p className="text-muted-foreground text-sm">{i18n._('offers.loading')}</p>;
  if (codes.data.length === 0) return <p className="text-muted-foreground text-sm">{i18n._('offers.codes-none')}</p>;
  return (
    <ul className="grid gap-1">
      {codes.data.map((code) => (
        <CodeRow
          key={code.id}
          code={code}
          disabled={disabled || remove.isPending}
          onRemove={() => {
            remove.mutate(code.code);
          }}
        />
      ))}
    </ul>
  );
}

interface CodeTextFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onText: (text: string) => void;
  readonly disabled: boolean;
  readonly maxLength?: number;
  readonly numeric?: boolean;
}

/** A left-to-right text input of the panel: codes, prefixes and counts read the same in Arabic. */
function CodeTextField({ onText, numeric = false, ...field }: CodeTextFieldProps): ReactNode {
  return (
    <TextField
      {...field}
      dir="ltr"
      inputMode={numeric ? 'numeric' : undefined}
      onChange={(event) => {
        onText(event.target.value);
      }}
    />
  );
}

/** The per-code limit field, blank for no limit. */
function LimitField(props: Pick<CodeTextFieldProps, 'value' | 'onText' | 'disabled'>): ReactNode {
  const { i18n } = useLingui();
  return (
    <CodeTextField {...props} label={i18n._('offers.codes-limit')} hint={i18n._('offers.field-blank-hint')} numeric />
  );
}

interface SubmitRowProps {
  readonly labelId: string;
  readonly disabled: boolean;
  readonly onSubmit: () => void;
}

function SubmitRow({ labelId, disabled, onSubmit }: SubmitRowProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div>
      <Button type="button" variant="outline" disabled={disabled} onClick={onSubmit}>
        {i18n._(labelId)}
      </Button>
    </div>
  );
}

/** Adds one typed code with its own limit (blank for none). */
function AddCode({ scope, offerId, disabled }: SavedPanelProps): ReactNode {
  const { i18n } = useLingui();
  const [code, setCode] = useState('');
  const [limit, setLimit] = useState('');
  const add = useCodeCommand((input: CodeInput) => addOfferCode(scope, offerId, input), 'offers.codes-saved');
  const submit = (): void => {
    const input = codeInputOf(code, limit);
    if (input === null) {
      toast.error(i18n._('offers.codes-invalid'));
      return;
    }
    add.mutate(input, {
      onSuccess: () => {
        setCode('');
      },
    });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <CodeTextField
        label={i18n._('offers.codes-code')}
        hint={i18n._('offers.codes-hint')}
        value={code}
        maxLength={CODE_MAX_LENGTH}
        disabled={disabled}
        onText={setCode}
      />
      <LimitField value={limit} disabled={disabled} onText={setLimit} />
      <SubmitRow labelId="offers.codes-add" disabled={disabled || add.isPending} onSubmit={submit} />
    </div>
  );
}

/** Draws a batch of random codes behind an optional prefix, each with the same limit (D2512). */
function GenerateCodes({ scope, offerId, disabled }: SavedPanelProps): ReactNode {
  const { i18n } = useLingui();
  const [count, setCount] = useState('');
  const [prefix, setPrefix] = useState('');
  const [limit, setLimit] = useState('');
  const generate = useCodeCommand(
    (input: GenerateCodesInput) => generateOfferCodes(scope, offerId, input),
    'offers.codes-saved',
  );
  const submit = (): void => {
    const input = generateInputOf(count, prefix, limit);
    if (input === null) toast.error(i18n._('offers.codes-invalid'));
    else generate.mutate(input);
  };
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">{i18n._('offers.codes-generate-heading')}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <CodeTextField
          label={i18n._('offers.codes-count')}
          value={count}
          disabled={disabled}
          onText={setCount}
          numeric
        />
        <CodeTextField
          label={i18n._('offers.codes-prefix')}
          value={prefix}
          maxLength={GENERATED_CODE_PREFIX_MAX}
          disabled={disabled}
          onText={setPrefix}
        />
        <LimitField value={limit} disabled={disabled} onText={setLimit} />
      </div>
      <SubmitRow labelId="offers.codes-generate" disabled={disabled || generate.isPending} onSubmit={submit} />
    </fieldset>
  );
}

/**
 * The codes of an offer activated by codes (D2403, D2540): its list with uses, one typed code, or a generated batch.
 * Codes belong to a saved offer, so a new one asks to be saved first.
 */
export function CodesPanel(props: CodesPanelProps): ReactNode {
  const { i18n } = useLingui();
  const { offerId } = props;
  return (
    <div className="grid gap-4" data-testid={CODES_PANEL_TEST_ID}>
      {offerId === null ? (
        <p className="text-muted-foreground text-sm">{i18n._('offers.codes-save-first')}</p>
      ) : (
        <>
          <CodeList {...props} offerId={offerId} />
          <AddCode {...props} offerId={offerId} />
          <GenerateCodes {...props} offerId={offerId} />
        </>
      )}
    </div>
  );
}
