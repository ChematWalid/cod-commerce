import { type CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUTH_PUBLIC_CONFIG } from '../application/tokens';
import type { AuthPublicConfig } from '../domain/public-config';

/** With the flag off the OAuth routes do not exist. On the controller, so it runs before the rate limit spends anything. */
@Injectable()
export class OAuthEnabledGuard implements CanActivate {
  constructor(@Inject(AUTH_PUBLIC_CONFIG) private readonly config: AuthPublicConfig) {}

  canActivate(): boolean {
    if (!this.config.oauthEnabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
