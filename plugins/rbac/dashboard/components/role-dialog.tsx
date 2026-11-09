import {
  PERMISSION_AREAS,
  PERMISSION_CATALOG,
  type PermissionKey,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
} from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Accordion,
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
  Textarea,
  toast,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { CANCEL_MESSAGE_ID, NO_START_ROLE, ROLES_QUERY_KEY } from '../constants';
import { errorMessageId } from '../error-messages';
import { roleNameIn, useUiLanguage } from '../labels';
import { type BusinessRoleDto, createRole, updateRole } from '../queries';
import {
  emptyDraft,
  previewOf,
  type RoleDraft,
  roleInputOf,
  withAreaLevel,
  withPermission,
  withStartFrom,
} from '../role-draft';
import { AreaPermissions } from './area-permissions';
import { LtrRun } from './ltr-run';

const NAME_INVALID_MESSAGE_ID = 'rbac.name-invalid';
const TOTAL_PERMISSIONS = PERMISSION_CATALOG.length;

interface RoleFormProps {
  /** The role being edited, or `null` for a new one. */
  readonly role: BusinessRoleDto | null;
  readonly roles: readonly BusinessRoleDto[];
  readonly onClose: () => void;
}

interface StartFromSelectProps {
  readonly roles: readonly BusinessRoleDto[];
  readonly value: string | null;
  readonly onChange: (roleId: string | null) => void;
}

function StartFromSelect({ roles, value, onChange }: StartFromSelectProps): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const id = useId();
  const selected = roles.find((role) => role.id === value);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._('rbac.start-from')}</Label>
      <Select
        value={value ?? NO_START_ROLE}
        onValueChange={(next) => {
          onChange(next === null || next === NO_START_ROLE ? null : next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{selected ? roleNameIn(selected, language) : i18n._('rbac.start-from-none')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_START_ROLE}>{i18n._('rbac.start-from-none')}</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {roleNameIn(role, language)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface AreaListProps {
  readonly draft: RoleDraft;
  readonly onChange: (draft: RoleDraft) => void;
}

function AreaList({ draft, onChange }: AreaListProps): ReactNode {
  const held = previewOf(draft);
  return (
    <Accordion multiple className="cod-rbac-accordion">
      {PERMISSION_AREAS.map((area) => (
        <AreaPermissions
          key={area.id}
          area={area}
          held={held}
          onLevel={(level) => {
            onChange(withAreaLevel(draft, area.id, level));
          }}
          onPermission={(key: PermissionKey, on: boolean) => {
            onChange(withPermission(draft, key, on));
          }}
        />
      ))}
    </Accordion>
  );
}

interface TextFieldsProps {
  readonly name: string;
  readonly description: string;
  readonly nameError: string | null;
  readonly onName: (name: string) => void;
  readonly onDescription: (description: string) => void;
}

function RoleTextFields({ name, description, nameError, onName, onDescription }: TextFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const nameId = useId();
  const descriptionId = useId();
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{i18n._('rbac.name')}</Label>
        <Input
          id={nameId}
          value={name}
          maxLength={ROLE_NAME_MAX_LENGTH}
          aria-invalid={nameError !== null}
          onChange={(event) => {
            onName(event.target.value);
          }}
        />
        {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>{i18n._('rbac.description')}</Label>
        <Textarea
          id={descriptionId}
          value={description}
          maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => {
            onDescription(event.target.value);
          }}
        />
      </div>
    </>
  );
}

function useSaveRole(
  role: BusinessRoleDto | null,
  onClose: () => void,
): ReturnType<typeof useMutation<unknown, unknown, Parameters<typeof createRole>[0]>> {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createRole>[0]) =>
      role === null ? createRole(input) : updateRole(role.id, input),
    onSuccess: async () => {
      toast.success(i18n._('rbac.saved'));
      await queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      onClose();
    },
  });
}

interface FooterProps {
  readonly heldCount: number;
  readonly saving: boolean;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

function RoleFormFooter({ heldCount, saving, onCancel, onSave }: FooterProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DialogFooter className="items-center sm:justify-between">
      <span className="text-muted-foreground text-xs">
        {i18n._('rbac.selected-count')} <LtrRun>{`${String(heldCount)} / ${String(TOTAL_PERMISSIONS)}`}</LtrRun>
      </span>
      <span className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {i18n._(CANCEL_MESSAGE_ID)}
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          {i18n._('rbac.save')}
        </Button>
      </span>
    </DialogFooter>
  );
}

function RoleForm({ role, roles, onClose }: RoleFormProps): ReactNode {
  const { i18n } = useLingui();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(role?.permissions ?? []));
  const save = useSaveRole(role, onClose);
  const submit = (): void => {
    setNameError(name.trim() === '' ? i18n._(NAME_INVALID_MESSAGE_ID) : null);
    if (name.trim() === '') return;
    save.mutate({ name, description: description.trim() === '' ? null : description, ...roleInputOf(draft) });
  };
  const startFrom = (roleId: string | null): void => {
    setDraft(withStartFrom(draft, roles.find((candidate) => candidate.id === roleId) ?? null));
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n._(role === null ? 'rbac.new-role' : 'rbac.edit-role')}</DialogTitle>
      </DialogHeader>
      <div className="cod-rbac-dialog-body grid gap-4">
        <RoleTextFields {...{ name, description, nameError }} onName={setName} onDescription={setDescription} />
        <StartFromSelect roles={roles} value={draft.startFromRoleId} onChange={startFrom} />
        <AreaList draft={draft} onChange={setDraft} />
      </div>
      {save.isError && (
        <p className="text-destructive text-sm" role="alert">
          {i18n._(errorMessageId(save.error))}
        </p>
      )}
      <RoleFormFooter heldCount={previewOf(draft).length} saving={save.isPending} onCancel={onClose} onSave={submit} />
    </>
  );
}

interface RoleDialogProps extends RoleFormProps {
  readonly open: boolean;
}

/** Creates or edits a custom role; it sends the user's choices and the server works out the permissions (D63). */
export function RoleDialog({ open, role, roles, onClose }: RoleDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="cod-rbac-dialog sm:max-w-2xl">
        {open && <RoleForm key={role?.id ?? 'new'} role={role} roles={roles} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
