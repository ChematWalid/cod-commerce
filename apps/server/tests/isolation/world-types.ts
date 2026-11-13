import type { Caller } from './http';

/*
 * The shape of the isolation world, apart from the code that builds it (world.ts), so the matrix, the runner and the
 * team rows can name it without importing the builder, which imports them.
 */

/** A store of the world: its label (`A1`) names it in transcripts. */
export interface WorldStore {
  readonly label: string;
  readonly id: string;
  readonly subdomain: string;
  readonly channelToken: string;
}

/** One business with a row in every P1 tenant table. */
export interface BusinessWorld {
  readonly label: 'A' | 'B';
  readonly businessId: string;
  readonly name: string;
  readonly stores: readonly [WorldStore, WorldStore];
  readonly owner: Caller & { readonly email: string; readonly administratorId: string; readonly lastName: string };
  /** A member with a business role on the first store only. */
  readonly member: Caller & { readonly email: string; readonly administratorId: string };
  readonly role: { readonly id: string; readonly name: string };
  readonly secret: { readonly id: string; readonly value: string };
  readonly note: { readonly id: string; readonly title: string };
  readonly logoAssetId: string;
}

/** The two businesses and the platform superadmin who provisioned them. */
export interface World {
  readonly a: BusinessWorld;
  readonly b: BusinessWorld;
  readonly superadmin: Caller;
}
