import { LOGO_MAX_BYTES } from '@cod/shared';
import { LogoTooLargeError, LogoTypeError } from '../domain/errors';
import { detectImageFormat } from '../domain/image-format';
import type { LogoAssetsPort } from '../domain/ports/logo-assets.port';
import type { OperationContext } from '../domain/ports/operation-context';

/** What an upload answers with. */
export interface UploadedLogo {
  readonly assetId: string;
}

/** Accepts a business logo (D34): at most {@link LOGO_MAX_BYTES}, and an image by its content. */
export class BusinessLogoService {
  constructor(private readonly assets: LogoAssetsPort) {}

  /**
   * @param bytes the file's bytes; a reader may stop at one byte over the limit, which is enough to refuse
   * @throws LogoTooLargeError or LogoTypeError
   */
  async upload(ctx: OperationContext, bytes: Uint8Array): Promise<UploadedLogo> {
    if (bytes.byteLength > LOGO_MAX_BYTES) {
      throw new LogoTooLargeError();
    }
    const type = detectImageFormat(bytes);
    if (type === undefined) {
      throw new LogoTypeError();
    }
    return { assetId: await this.assets.store(ctx, { bytes, type }) };
  }
}
