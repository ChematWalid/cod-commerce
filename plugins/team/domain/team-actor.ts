import type { TenantScope } from '@cod/shared';

/** Who performs a team action: the signed-in administrator, its business and where the request came from. */
export interface TeamActor {
  readonly administratorId: number;
  readonly scope: TenantScope;
  readonly ip: string | null;
  readonly userAgent: string | null;
}
