import gql from 'graphql-tag';

/** A note as these tests read it. */
export interface NoteResult {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
}

const NOTE_FIELDS = 'id title body createdAt';

export const CREATE_NOTE = gql`
  mutation ($input: CreateTemplateNoteInput!) {
    createTemplateNote(input: $input) { ${NOTE_FIELDS} }
  }
`;

export const NOTE_BY_ID = gql`
  query ($id: String!) {
    templateNote(id: $id) { ${NOTE_FIELDS} }
  }
`;

export const NOTES = gql`
  query ($take: Int) {
    templateNotes(take: $take) { ${NOTE_FIELDS} }
  }
`;

/** Valkey for the tenancy plugin these tests boot with the template. */
export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
