import { INVALID_PHONE_MESSAGE_ID, REQUIRED_FIELD_MESSAGE_ID } from './constants';

/** Catalogue ids of the failing fields, by field name. */
export type FieldErrors = Readonly<Record<string, string>>;

interface ParseFailure {
  readonly success: false;
  readonly error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] };
}

/** A `@cod/shared` schema, seen only through what the forms need. */
interface FormSchema {
  safeParse(value: unknown): { readonly success: true } | ParseFailure;
}

const CATALOGUE_MESSAGE_PREFIX = 'auth.';
const MESSAGE_ID_BY_FIELD: Readonly<Record<string, string>> = {
  email: 'auth.email-invalid',
  newEmail: 'auth.email-invalid',
  phone: INVALID_PHONE_MESSAGE_ID,
};

function messageIdOf(field: string, schemaMessage: string): string {
  if (schemaMessage.startsWith(CATALOGUE_MESSAGE_PREFIX)) return schemaMessage;
  return MESSAGE_ID_BY_FIELD[field] ?? REQUIRED_FIELD_MESSAGE_ID;
}

/**
 * Runs a shared schema for instant feedback only: the server re-runs the same schema and decides (ADR 0017 §1).
 */
export function fieldErrorsOf(schema: FormSchema, values: unknown): FieldErrors {
  const parsed = schema.safeParse(values);
  if (parsed.success) return {};
  const entries = parsed.error.issues.map((issue): [string, string] => {
    const field = String(issue.path[0] ?? '');
    return [field, messageIdOf(field, issue.message)];
  });
  return Object.fromEntries(entries);
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
