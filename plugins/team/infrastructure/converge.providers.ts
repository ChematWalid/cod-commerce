import type { Provider } from '@nestjs/common';
import { TeamConvergeService } from '../application/converge-members.service';
import {
  ACCESS_HOLDERS,
  ADMINISTRATOR_PROFILES,
  BUSINESS_DIRECTORY,
  CLOCK,
  ID_GENERATOR,
  MEMBER_REPOSITORY,
  TRANSACTION,
} from '../application/tokens';
import type { AccessHoldersPort } from '../domain/ports/access-holders.port';
import type { AdministratorProfilesPort } from '../domain/ports/administrator-profiles.port';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { RbacAccessHoldersAdapter } from './rbac-access-holders.adapter';
import { TeamLifecycleHook } from './team-lifecycle.hook';
import { TenancyAdministratorProfilesAdapter } from './tenancy-administrator-profiles.adapter';
import { TenancyBusinessDirectoryAdapter } from './tenancy-business-directory.adapter';

const systemClock: ClockPort = { now: () => new Date() };

type ConvergeDependencies = [
  BusinessDirectoryPort,
  AccessHoldersPort,
  AdministratorProfilesPort,
  MemberRepositoryPort,
  TransactionPort,
  IdGeneratorPort,
  ClockPort,
];

/** Wires the member converge and the provisioning hook (D215); kept out of the plugin file, which lists its parts. */
export const CONVERGE_PROVIDERS: Provider[] = [
  { provide: CLOCK, useValue: systemClock },
  { provide: BUSINESS_DIRECTORY, useClass: TenancyBusinessDirectoryAdapter },
  { provide: ACCESS_HOLDERS, useClass: RbacAccessHoldersAdapter },
  { provide: ADMINISTRATOR_PROFILES, useClass: TenancyAdministratorProfilesAdapter },
  {
    provide: TeamConvergeService,
    useFactory: (...[directory, holders, profiles, members, transaction, ids, clock]: ConvergeDependencies) =>
      new TeamConvergeService({ directory, holders, profiles, members, transaction, ids, clock }),
    inject: [
      BUSINESS_DIRECTORY,
      ACCESS_HOLDERS,
      ADMINISTRATOR_PROFILES,
      MEMBER_REPOSITORY,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
  },
  TeamLifecycleHook,
];
