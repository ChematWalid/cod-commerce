import type { Provider } from '@nestjs/common';
import { GetMemberService } from '../application/get-member.service';
import { ListMembersService } from '../application/list-members.service';
import type { MemberReadPorts } from '../application/member-read-ports';
import {
  CLOCK,
  INVITATION_REPOSITORY,
  MEMBER_ACCESS,
  MEMBER_DIRECTORY,
  MEMBER_READ_PORTS,
  MEMBER_REPOSITORY,
} from '../application/tokens';
import { MemberDirectoryAdapter } from './member-directory.adapter';

/** Wires the member reads (brief step 3) to their adapters; rbac access and the clock come from the invitation wiring. */
export const MEMBER_READ_PROVIDERS: Provider[] = [
  { provide: MEMBER_DIRECTORY, useClass: MemberDirectoryAdapter },
  {
    provide: MEMBER_READ_PORTS,
    useFactory: (
      ...[members, invitations, access, directory, clock]: [
        MemberReadPorts['members'],
        MemberReadPorts['invitations'],
        MemberReadPorts['access'],
        MemberReadPorts['directory'],
        MemberReadPorts['clock'],
      ]
    ): MemberReadPorts => ({ members, invitations, access, directory, clock }),
    inject: [MEMBER_REPOSITORY, INVITATION_REPOSITORY, MEMBER_ACCESS, MEMBER_DIRECTORY, CLOCK],
  },
  ...[ListMembersService, GetMemberService].map((useCase) => ({
    provide: useCase,
    useFactory: (ports: MemberReadPorts) => new useCase(ports),
    inject: [MEMBER_READ_PORTS],
  })),
];
