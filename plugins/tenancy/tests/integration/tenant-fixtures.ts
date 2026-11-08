import type { INestApplication } from '@nestjs/common';
import { RequestContextService } from '@vendure/core';
import gql from 'graphql-tag';
import { type ProvisionedBusiness, ProvisionBusinessService } from '../../application/provision-business.service';
import { asOperationContext } from '../../domain/ports/operation-context';

/** The password of every owner these tests provision. */
export const OWNER_PASSWORD = 'synthetic-owner-password';

/** Stores need every platform language offered (A4). */
export const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

/** Provisions a business with one store, its owner being `${slug}-owner@example.test`. */
export async function provisionBusiness(app: INestApplication, slug: string): Promise<ProvisionedBusiness> {
  const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
  return app.get(ProvisionBusinessService).provision(asOperationContext(ctx), {
    name: `${slug} SARL`,
    owner: {
      emailAddress: `${slug}-owner@example.test`,
      firstName: slug,
      lastName: 'Owner',
      password: OWNER_PASSWORD,
    },
    store: { name: `${slug} store`, subdomain: slug, language: 'ar' },
  });
}
