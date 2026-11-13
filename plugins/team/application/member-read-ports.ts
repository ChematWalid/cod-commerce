import type { ClockPort } from '../domain/ports/clock.port';
import type { InvitationRepositoryPort } from '../domain/ports/invitation-repository.port';
import type { MemberAccessPort } from '../domain/ports/member-access.port';
import type { MemberDirectoryPort } from '../domain/ports/member-directory.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';

/** What the member reads (list, get) go through. They write nothing. */
export interface MemberReadPorts {
  readonly members: Pick<MemberRepositoryPort, 'listLive' | 'findById'>;
  readonly invitations: Pick<InvitationRepositoryPort, 'latestOfMembers'>;
  readonly access: Pick<MemberAccessPort, 'reachOf'>;
  readonly directory: MemberDirectoryPort;
  readonly clock: ClockPort;
}
