import { CrudPermissionDefinition } from '@vendure/core';

/** `CreateTemplateNote`, `ReadTemplateNote`, `UpdateTemplateNote` and `DeleteTemplateNote`, assignable to roles. */
export const templateNotePermission = new CrudPermissionDefinition('TemplateNote');
