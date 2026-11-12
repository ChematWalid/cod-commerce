import { useLingui } from '@lingui/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import {
  DEFAULT_OVERRIDE_SCOPE,
  FLAGS_CANCEL_MESSAGE_ID,
  OVERRIDE_SCOPES,
  type OverrideScope,
  SCOPE_MESSAGE_IDS,
  TARGET_ID_MAX_LENGTH,
} from '../constants';
import { flagErrorMessageId } from '../error-messages';
import { useSetOverride } from '../hooks/use-flag-mutations';

interface ScopeSelectProps {
  readonly value: OverrideScope;
  readonly onChange: (scope: OverrideScope) => void;
}

function ScopeSelect({ value, onChange }: ScopeSelectProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('flags.column-scope')}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{i18n._(SCOPE_MESSAGE_IDS[value])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OVERRIDE_SCOPES.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {i18n._(SCOPE_MESSAGE_IDS[candidate])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface TargetFieldProps {
  readonly value: string;
  readonly onChange: (scopeId: string) => void;
}

function TargetField({ value, onChange }: TargetFieldProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('flags.target-id')}</Label>
      <Input
        id={id}
        dir="ltr"
        className="text-start"
        value={value}
        maxLength={TARGET_ID_MAX_LENGTH}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p className="text-muted-foreground text-xs">{i18n._('flags.target-hint')}</p>
    </div>
  );
}

function EnabledField({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (on: boolean) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{i18n._('flags.override-enabled')}</Label>
      <Switch id={id} className="cod-flags-switch" checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface FormProps {
  readonly flagKey: string;
  readonly onClose: () => void;
}

function OverrideForm({ flagKey, onClose }: FormProps): ReactNode {
  const { i18n } = useLingui();
  const [scope, setScope] = useState<OverrideScope>(DEFAULT_OVERRIDE_SCOPE);
  const [scopeId, setScopeId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const save = useSetOverride(onClose);
  const submit = (): void => {
    save.mutate({ key: flagKey, scope, scopeId: scopeId.trim(), enabled });
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._('flags.override-dialog-title', { flag: flagKey })}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <ScopeSelect value={scope} onChange={setScope} />
        <TargetField value={scopeId} onChange={setScopeId} />
        <EnabledField checked={enabled} onChange={setEnabled} />
      </div>
      {save.isError && (
        <p className="text-destructive text-sm" role="alert">
          {i18n._(flagErrorMessageId(save.error))}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {i18n._(FLAGS_CANCEL_MESSAGE_ID)}
        </Button>
        <Button type="button" disabled={scopeId.trim() === '' || save.isPending} onClick={submit}>
          {i18n._('flags.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

interface OverrideDialogProps extends FormProps {
  readonly open: boolean;
}

/** Adds an override of a flag for a plan, a business or a store. */
export function OverrideDialog({ open, flagKey, onClose }: OverrideDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-flags-dialog sm:max-w-md">
        {open && <OverrideForm flagKey={flagKey} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
