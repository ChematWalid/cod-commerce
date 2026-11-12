import { randomBytes } from 'node:crypto';
import type { BusinessFixture } from '@cod/testing';
import gql from 'graphql-tag';
import type { TeamKit } from './team-kit';

const COMMISSION_FIELDS = `
  id
  name
  basis
  valueKind
  value
  scope
  storeIds
  createdAt
  updatedAt
`;

export const TEAM_COMMISSION_CONFIGS = gql`
  query {
    teamCommissionConfigs { ${COMMISSION_FIELDS} }
  }
`;

export const TEAM_COMMISSION_CONFIG = gql`
  query ($id: String!) {
    teamCommissionConfig(id: $id) { ${COMMISSION_FIELDS} }
  }
`;

export const TEAM_COMMISSION_BASES = gql`
  query {
    teamCommissionBases {
      basis
      labels {
        ar
        en
      }
    }
  }
`;

export const CREATE_TEAM_COMMISSION_CONFIG = gql`
  mutation ($input: TeamCommissionConfigInput!) {
    createTeamCommissionConfig(input: $input) { ${COMMISSION_FIELDS} }
  }
`;

export const UPDATE_TEAM_COMMISSION_CONFIG = gql`
  mutation ($id: String!, $input: UpdateTeamCommissionConfigInput!) {
    updateTeamCommissionConfig(id: $id, input: $input) { ${COMMISSION_FIELDS} }
  }
`;

export const DELETE_TEAM_COMMISSION_CONFIG = gql`
  mutation ($id: String!) {
    deleteTeamCommissionConfig(id: $id)
  }
`;

/** A commission config as the API answers it. */
export interface CommissionAnswer {
  readonly id: string;
  readonly name: string;
  readonly basis: string;
  readonly valueKind: 'fixed' | 'percent';
  readonly value: number;
  readonly scope: 'all' | 'selected';
  readonly storeIds: readonly string[];
}

/** One basis a commission can be earned on, with its labels. */
export interface BasisAnswer {
  readonly basis: string;
  readonly labels: { readonly ar: string; readonly en: string };
}

/** The REST collection of commission configs. */
export const CONFIGS = '/commissions/configs';
/** The value every test commission starts with; no activity row may carry it (D216). */
export const FIRST_VALUE = 8_317;
/** The value tests change a commission to; no activity row may carry it either. */
export const SECOND_VALUE = 9_421;

/** A name no other test or run uses. */
export const uniqueName = (label: string): string => `${label} ${randomBytes(3).toString('hex')}`;

/** A fixed per-confirmed-order commission body on every store. */
export const configBody = (name: string, value = FIRST_VALUE) => ({
  name,
  basis: 'per-confirmed-order',
  valueKind: 'fixed',
  value,
  scope: 'all',
});

/** Signs in as the business owner in a session of its own. */
export const ownerOf = (kit: TeamKit, business: BusinessFixture): Promise<string> =>
  kit.newSession(business.owner, business.stores[0]);

/** A config of `business`, created by its owner over REST; leaves the owner signed in. */
export async function configOf(
  kit: TeamKit,
  business: BusinessFixture,
  name = uniqueName('Bonus'),
): Promise<CommissionAnswer> {
  await ownerOf(kit, business);
  const created = await kit.rest('POST', CONFIGS, configBody(name));
  if (created.status !== 201) throw new Error(`could not create a commission: ${JSON.stringify(created.body)}`);
  return created.body as CommissionAnswer;
}
