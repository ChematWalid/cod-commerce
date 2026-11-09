import gql from 'graphql-tag';

export const ACTIVITY_LOG_QUERY = gql`
  query ($input: ActivityLogInput) {
    activityLog(input: $input) {
      nextCursor
      items {
        id
        action
        entityType
        entityId
        summary
        diff
        actor {
          id
          name
        }
        ip
        storeId
        createdAt
      }
    }
  }
`;

export const PUBLISH = gql`
  mutation ($entityType: String!, $entityId: String!, $failAfter: Boolean!) {
    rbacTestPublishActivity(entityType: $entityType, entityId: $entityId, failAfter: $failAfter)
  }
`;

export const ACTIVE_ADMINISTRATOR = gql`
  query {
    activeAdministrator {
      id
    }
  }
`;

export interface Item {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;
  readonly diff: Record<string, unknown>;
  readonly actor: { readonly id: string; readonly name: string } | null;
  readonly ip: string | null;
  readonly storeId: string | null;
  readonly createdAt: string;
}

export interface Page {
  readonly activityLog: { readonly nextCursor: string | null; readonly items: readonly Item[] };
}

export interface Filters {
  readonly first?: number;
  readonly after?: string;
  readonly actorAdministratorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
}
