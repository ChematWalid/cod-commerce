import gql from 'graphql-tag';

/** The platform jobs health query: staff only (D120). Ages are whole seconds. */
export const jobsHealthSchema = gql`
  type TaskHealth {
    id: String!
    lastSuccessAgeSeconds: Int
  }

  type PlatformJobsHealth {
    outboxPending: Int!
    outboxOldestPendingAgeSeconds: Int
    tasks: [TaskHealth!]!
  }

  extend type Query {
    platformJobsHealth: PlatformJobsHealth!
  }
`;
