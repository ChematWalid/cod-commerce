/**
 * A note as the `templateNotes` query returns it over the wire (`createdAt` is an ISO string). Declared here
 * rather than read from the generated `@/gql` types, which only `build:dashboard` writes (P0.S2b-4 ruling P4-1).
 */
export interface TemplateNoteDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
}

/** The result of {@link TEMPLATE_NOTES_QUERY}. */
export interface TemplateNotesResult {
  readonly templateNotes: readonly TemplateNoteDto[];
}

/** The variables of {@link TEMPLATE_NOTES_QUERY}. */
export interface TemplateNotesVariables {
  readonly take: number;
}

/** The newest notes of the selected channel's business; an untyped document, typed by the interfaces above. */
export const TEMPLATE_NOTES_QUERY = /* GraphQL */ `
  query TemplateNotes($take: Int) {
    templateNotes(take: $take) {
      id
      title
      body
      createdAt
    }
  }
`;
