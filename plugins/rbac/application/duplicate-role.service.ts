import { ACTIVITY_ACTIONS, BUILT_IN_ROLES } from '@cod/shared';
import type { BusinessRole } from '../domain/business-role';
import type { OperationContext } from '../domain/ports/operation-context';
import { type CopyLocale, copyLocaleOf, copyNameOf } from '../domain/role-name';
import { type BusinessRoleView, toRoleView } from '../domain/role-view';
import { insertCustomRole } from './create-role.service';
import type { RoleActor, RoleWriter } from './role-writer';

/** A built-in has no stored Arabic name, so its label supplies the copy's name (D71). */
const sourceNameOf = (role: BusinessRole, locale: CopyLocale): string => {
  const template = BUILT_IN_ROLES.find(({ key }) => key === role.builtInKey);
  return template?.label[locale] ?? role.name;
};

/** Copies a role under a free name, with the same permissions (D71). */
export class DuplicateRoleService {
  constructor(private readonly writer: RoleWriter) {}

  /** The lock makes concurrent duplicates take `(copy)` and `(copy 2)` (Review Focus 4). */
  duplicate(
    ctx: OperationContext,
    actor: RoleActor,
    { id, locale }: { readonly id: string; readonly locale: string | undefined },
  ): Promise<BusinessRoleView> {
    return this.writer.write(ctx, actor, async (transactional, world) => {
      const source = this.writer.requireRole(world, id);
      const copyLocale = copyLocaleOf(locale);
      const taken = new Set(world.roles.map((role) => role.nameKey));
      const name = copyNameOf(sourceNameOf(source, copyLocale), copyLocale, (key) => taken.has(key));
      const role = { ...name, description: source.description, permissions: source.permissions };
      const row = await insertCustomRole(
        this.writer,
        { ctx: transactional, actor, world },
        role,
        ACTIVITY_ACTIONS.ROLE_DUPLICATED,
      );
      return { result: toRoleView(row, 0), flush: [] };
    });
  }
}
