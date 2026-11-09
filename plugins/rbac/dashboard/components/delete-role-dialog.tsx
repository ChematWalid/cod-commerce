import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  toast,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { CANCEL_MESSAGE_ID, ROLES_QUERY_KEY } from '../constants';
import { errorMessageId } from '../error-messages';
import { type BusinessRoleDto, deleteRole } from '../queries';

interface DeleteRoleDialogProps {
  readonly role: BusinessRoleDto | null;
  readonly onClose: () => void;
}

function useDeleteRole(onClose: () => void): ReturnType<typeof useMutation<unknown, unknown, string>> {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: async () => {
      toast.success(i18n._('rbac.deleted'));
      await queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageId(error)));
      onClose();
    },
  });
}

/** Asks before a role is deleted; the server refuses one that members still hold, and that refusal is shown. */
export function DeleteRoleDialog({ role, onClose }: DeleteRoleDialogProps): ReactNode {
  const { i18n } = useLingui();
  const remove = useDeleteRole(onClose);
  return (
    <AlertDialog
      open={role !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n._('rbac.delete-title', { name: role?.name ?? '' })}</AlertDialogTitle>
          <AlertDialogDescription>{i18n._('rbac.delete-warning')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n._(CANCEL_MESSAGE_ID)}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (role !== null) remove.mutate(role.id);
            }}
          >
            {i18n._('rbac.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
