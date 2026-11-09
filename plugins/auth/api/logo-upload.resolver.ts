import type { Readable } from 'node:stream';
import { LOGO_MAX_BYTES } from '@cod/shared';
import { tenantBusinessPermission, TenantScoped } from '@cod/plugin-tenancy';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, type RequestContext, Transaction } from '@vendure/core';
import { BusinessLogoService, type UploadedLogo } from '../application/business-logo.service';
import { withApiErrors } from './error-mapping';
import { operationOf } from './operation';
import { readAtMost } from './read-upload';

/** The part of a `graphql-upload` file this resolver reads. Its mimetype and name are the client's claim: unused. */
interface UploadedFile {
  createReadStream(): Readable;
}

/** Business logos (D34). */
@Resolver()
export class LogoUploadResolver {
  constructor(private readonly logos: BusinessLogoService) {}

  /**
   * Stores an image on the active store's channel. The wizard then passes the id to `updateBusiness` and
   * `updateStore`, which refuse an asset of another business.
   */
  @Transaction()
  @Mutation()
  @Allow(tenantBusinessPermission.Update)
  @TenantScoped()
  uploadBusinessLogo(@Ctx() ctx: RequestContext, @Args('file') file: Promise<UploadedFile>): Promise<UploadedLogo> {
    return withApiErrors(async () => {
      // One byte over the limit is enough to refuse; the rest of a large file is never read.
      const bytes = await readAtMost((await file).createReadStream(), LOGO_MAX_BYTES + 1);
      return this.logos.upload(operationOf(ctx), bytes);
    });
  }
}
