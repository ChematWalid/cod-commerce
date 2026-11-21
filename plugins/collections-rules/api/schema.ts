import gql from 'graphql-tag';
import { collectionsAdminApiSchema } from './collections-schema';
import { rulesAdminApiSchema } from './rules-schema';

/** Every operation of the collections Admin API: collections and their members, then the rule builder. */
export const collectionsRulesAdminApiSchema = gql`
  ${collectionsAdminApiSchema}
  ${rulesAdminApiSchema}
`;
