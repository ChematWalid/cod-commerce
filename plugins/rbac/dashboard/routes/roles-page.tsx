import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionBarItem,
  Button,
  type DashboardRouteDefinition,
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
  CREATE_ROLE_KEY,
  LOADING_MESSAGE_ID,
  ROLES_NAV_TITLE,
  ROLES_PATH,
  ROLES_QUERY_KEY,
  ROLES_VIEW_VENDURE_PERMISSION,
  TEAM_NAV_SECTION_ID,
} from '../constants';
import { errorMessageId } from '../error-messages';
import { useUiLanguage } from '../labels';
import { type BusinessRoleDto, duplicateRole, useBusinessRoles, useEffectivePermissions } from '../queries';

const PAGE_ID = 'rbac-roles';
const BLOCK_ID = 'rbac-roles-list';
const NEW_ROLE_ACTION_ID = 'rbac-new-role';
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

function RolesPage(): ReactNode {
  const { i18n } = useLingui();
  const roles = useBusinessRoles();
  const held = useEffectivePermissions();
  const onDuplicate = useDuplicateRole();
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [deleting, setDeleting] = useState<BusinessRoleDto | null>(null);
  const openEditor = (role: BusinessRoleDto | null): void => {
    setEditor({ open: true, role });
  };
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(ROLES_NAV_TITLE)}</PageTitle>
      <PageActionBar>
        {held.has(CREATE_ROLE_KEY) && (
          <ActionBarItem itemId={NEW_ROLE_ACTION_ID}>
            <Button onClick={openEditor.bind(null, null)}>{i18n._('rbac.new-role')}</Button>
          </ActionBarItem>
        )}
      </PageActionBar>
      <PageLayout>
        <FullWidthPageBlock blockId={BLOCK_ID}>
          <RolesList roles={roles} held={held} onEdit={openEditor} onDuplicate={onDuplicate} onDelete={setDeleting} />
        </FullWidthPageBlock>
      </PageLayout>
      <RoleDialog
        open={editor.open}
        role={editor.open ? editor.role : null}
        roles={roles.data ?? []}
        onClose={setEditor.bind(null, { open: false })}
      />
      <DeleteRoleDialog role={deleting} onClose={setDeleting.bind(null, null)} />
    </Page>
  );
}

/** The roles of the business, and the dialogs that change them. */
export const rolesRoute: DashboardRouteDefinition = {
  path: ROLES_PATH,
  component: () => <RolesPage />,
  navMenuItem: {
    sectionId: TEAM_NAV_SECTION_ID,
    id: 'rbac-roles',
    title: ROLES_NAV_TITLE,
    url: ROLES_PATH,
    requiresPermission: ROLES_VIEW_VENDURE_PERMISSION,
  },
};
