import gql from 'graphql-tag';

/** The RBAC Admin API. Our ids are `String` (D1); a core administrator id crosses as decimal text (D68). */
export const adminApiSchema = gql`
  input ActivityLogInput {
    first: Int
    after: String
    actorAdministratorId: String
    action: String
    entityType: String
    entityId: String
  }

  type ActivityActor {
    id: String!
    name: String!
  }

  type ActivityLogItem {
    id: String!
    action: String!
    entityType: String!
    entityId: String!
    summary: String!
    diff: JSON!
    actor: ActivityActor
    ip: String
    storeId: String
    createdAt: DateTime!
  }

  type ActivityLogPage {
    items: [ActivityLogItem!]!
    nextCursor: String
  }

  extend type Query {
    activityLog(input: ActivityLogInput): ActivityLogPage!
  }
`;
