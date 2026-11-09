import { AUTH_ERROR_CODES } from '@cod/shared';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import {
  type AssetPreviewStrategy,
  ConfigService,
  I18nError,
  type Injector,
  LogLevel,
  type RequestContext,
} from '@vendure/core';
import { detectImageFormat } from '../domain/image-format';

const IMAGE_MIME_PREFIX = 'image/';

/** An upload whose bytes are not an accepted image; core's own errors have no such code. */
class ImageTypeError extends I18nError {
  constructor() {
    // Info: a caller's bad file, not a fault of the server.
    super('The image must be a PNG, JPEG, GIF or WebP file', {}, AUTH_ERROR_CODES.IMAGE_TYPE, LogLevel.Info);
  }
}

/**
 * Core's upload check trusts the file name when it cannot recognise the content, so a script-bearing SVG or a text
 * file named `photo.png` is stored as an image. Every upload passes through the preview step with the stored
 * bytes, so this is where the bytes are checked against the accepted formats, whatever the client claimed.
 */
export class ContentCheckedPreviewStrategy implements AssetPreviewStrategy {
  constructor(private readonly delegate: AssetPreviewStrategy) {}

  async generatePreviewImage(ctx: RequestContext, mimeType: string, data: Buffer): Promise<Buffer> {
    if (mimeType.startsWith(IMAGE_MIME_PREFIX) && detectImageFormat(data) === undefined) {
      throw new ImageTypeError();
    }
    return this.delegate.generatePreviewImage(ctx, mimeType, data);
  }

  init(injector: Injector): Promise<void> | void {
    return this.delegate.init?.(injector);
  }

  destroy(): Promise<void> | void {
    return this.delegate.destroy?.();
  }
}

/**
 * Puts {@link ContentCheckedPreviewStrategy} around whichever preview strategy is configured, once the whole
 * config is built, so the order of the plugins does not matter.
 */
@Injectable()
export class AssetContentGuard implements OnApplicationBootstrap {
  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap(): void {
    const { assetOptions } = this.config;
    if (!(assetOptions.assetPreviewStrategy instanceof ContentCheckedPreviewStrategy)) {
      assetOptions.assetPreviewStrategy = new ContentCheckedPreviewStrategy(assetOptions.assetPreviewStrategy);
    }
  }
}
