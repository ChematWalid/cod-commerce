import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ActionBarItem,
  Button,
  FullWidthPageBlock,
  Page,
  PageActionBar,
  PageLayout,
  PageTitle,
  toast,
} from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { DeleteRoleDialog } from '../components/delete-role-dialog';
import { RoleDialog } from '../components/role-dialog';
import { type RoleActions, RolesTable } from '../components/roles-table';
import {
  ACTIVITY_LOG_NAV_TITLE,
  ACTIVITY_LOG_PATH,
  CREATE_ROLE_KEY,
  LOADING_MESSAGE_ID,
  ROLES_NAV_TITLE,
  ROLES_QUERY_KEY,
  VIEW_ACTIVITY_LOG_KEY,
} from '../constants';
import { errorMessageId } from '../error-messages';
import { useUiLanguage } from '../labels';
import { type BusinessRoleDto, duplicateRole, useBusinessRoles, useEffectivePermissions } from '../queries';

const PAGE_ID = 'rbac-roles';
const BLOCK_ID = 'rbac-roles-list';
const NEW_ROLE_ACTION_ID = 'rbac-new-role';
const ACTIVITY_LOG_ACTION_ID = 'rbac-activity-log-link';
const ARABIC = 'ar';
const ENGLISH = 'en';

interface RolesListProps extends RoleActions {
  readonly roles: ReturnType<typeof useBusinessRoles>;
  readonly held: ReadonlySet<string>;
}

/** The dialog open on the page: `role` is `null` for a new role. */
type EditorState = { readonly open: false } | { readonly open: true; readonly role: BusinessRoleDto | null };

function useDuplicateRole(): (role: BusinessRoleDto) => void {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const queryClient = useQueryClient();
  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateRole(id, language === ARABIC ? ARABIC : ENGLISH),
    onSuccess: async () => {
      toast.success(i18n._('rbac.duplicated'));
      await queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageId(error)));
    },
  });
  return (role) => {
    duplicate.mutate(role.id);
  };
}

function RolesList({ held, onEdit, onDelete, roles, onDuplicate }: RolesListProps): ReactNode {
  const { i18n } = useLingui();
  if (roles.isError) return <p role="alert">{i18n._(errorMessageId(roles.error))}</p>;
  if (!roles.isSuccess) return <p>{i18n._(LOADING_MESSAGE_ID)}</p>;
  return <RolesTable roles={roles.data} held={held} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />;
}

/** Which role dialogs are open. */
function useRoleEditors() {
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [deleting, setDeleting] = useState<BusinessRoleDto | null>(null);
  const openEditor = (role: BusinessRoleDto | null): void => {
    setEditor({ open: true, role });
  };
  return { editor, setEditor, deleting, setDeleting, openEditor };
}

interface RoleDialogsProps {
  readonly roles: readonly BusinessRoleDto[];
  readonly editor: EditorState;
  readonly onCloseEditor: (state: EditorState) => void;
  readonly deleting: BusinessRoleDto | null;
  readonly onCloseDelete: (role: null) => void;
}

function RoleDialogs({ roles, editor, onCloseEditor, deleting, onCloseDelete }: RoleDialogsProps): ReactNode {
  return (
    <>
      <RoleDialog
        open={editor.open}
        role={editor.open ? editor.role : null}
        roles={roles}
        onClose={onCloseEditor.bind(null, { open: false })}
      />
      <DeleteRoleDialog role={deleting} onClose={onCloseDelete.bind(null, null)} />
    </>
  );
}

/** The roles of the business and the dialogs that change them, shown by the shell's `team.roles` leaf. */
export function RolesPage(): ReactNode {
  const { i18n } = useLingui();
  const roles = useBusinessRoles();
  const { held, error: heldError } = useEffectivePermissions();
  const onDuplicate = useDuplicateRole();
  const { editor, setEditor, deleting, setDeleting, openEditor } = useRoleEditors();
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(ROLES_NAV_TITLE)}</PageTitle>
      <PageActionBar>
        {held.has(VIEW_ACTIVITY_LOG_KEY) && (
          <ActionBarItem itemId={ACTIVITY_LOG_ACTION_ID}>
            <Button variant="outline" render={<Link to={ACTIVITY_LOG_PATH} />}>
              {i18n._(ACTIVITY_LOG_NAV_TITLE)}
            </Button>
          </ActionBarItem>
        )}
        {held.has(CREATE_ROLE_KEY) && (
          <ActionBarItem itemId={NEW_ROLE_ACTION_ID}>
            <Button onClick={openEditor.bind(null, null)}>{i18n._('rbac.new-role')}</Button>
          </ActionBarItem>
        )}
      </PageActionBar>
      <PageLayout>
        <FullWidthPageBlock blockId={BLOCK_ID}>
          {heldError !== null && <p role="alert">{i18n._(errorMessageId(heldError))}</p>}
          <RolesList roles={roles} held={held} onEdit={openEditor} onDuplicate={onDuplicate} onDelete={setDeleting} />
        </FullWidthPageBlock>
      </PageLayout>
      <RoleDialogs
        roles={roles.data ?? []}
        editor={editor}
        onCloseEditor={setEditor}
        deleting={deleting}
        onCloseDelete={setDeleting}
      />
    </Page>
  );
}
