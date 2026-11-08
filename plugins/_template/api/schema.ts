import gql from 'graphql-tag';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../domain/constants';

/**
 * The Admin API of the template. Note ids are `String!`, not `ID!`: Vendure decodes every `ID` argument with
 * the entity id strategy, and the default one turns a 63-bit id into a JavaScript number, which loses digits
 * (ADR 0003 ids are strings everywhere). The input has no `businessId`: the business is the caller's.
 */
export const adminApiSchema = gql`
  type TemplateNote {
    id: String!
    title: String!
    body: String!
    createdAt: DateTime!
  }

  input CreateTemplateNoteInput {
    title: String!
    body: String!
  }

  extend type Query {
    "A note of the caller's business, or null."
    templateNote(id: String!): TemplateNote
    "The caller's notes, newest first: take defaults to ${String(DEFAULT_PAGE_SIZE)} and is capped at ${String(MAX_PAGE_SIZE)}."
    templateNotes(take: Int, skip: Int): [TemplateNote!]!
  }

  extend type Mutation {
    "Creates a note for the caller's business."
    createTemplateNote(input: CreateTemplateNoteInput!): TemplateNote!
  }
`;
