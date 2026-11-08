/** Injection token of the `NoteRepositoryPort` adapter. */
export const NOTE_REPOSITORY: unique symbol = Symbol('TemplateNoteRepository');

/** Injection token of the `IdGeneratorPort` adapter. */
export const ID_GENERATOR: unique symbol = Symbol('TemplateNoteIdGenerator');

/** Injection token of the `TenantScopeResolver` of the Admin API. */
export const TENANT_SCOPE_RESOLVER: unique symbol = Symbol('TemplateTenantScopeResolver');
