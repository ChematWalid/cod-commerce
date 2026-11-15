import gql from 'graphql-tag';
import { collectionsAdminApiSchema } from './collections-schema';

/** Every operation of the collections Admin API; later areas (rules, preview) join this document. */
export const collectionsRulesAdminApiSchema = gql`
  ${collectionsAdminApiSchema}
`;
