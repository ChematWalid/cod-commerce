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
import sharp from 'sharp';
import { detectImageFormat, MAX_IMAGE_PIXELS } from '../domain/image-format';

const IMAGE_MIME_PREFIX = 'image/';

/** An upload whose bytes are not an accepted image; core's own errors have no such code. */
export class ImageTypeError extends I18nError {
  constructor() {
    // Info: a caller's bad file, not a fault of the server.
    super('The image must be a PNG, JPEG, GIF or WebP file', {}, AUTH_ERROR_CODES.IMAGE_TYPE, LogLevel.Info);
  }
}

/** Reads the header, refuses an image over {@link MAX_IMAGE_PIXELS}, then decodes all of it; a bad body fails here. */
async function assertDecodable(data: Buffer): Promise<void> {
  try {
    const image = sharp(data, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' });
    const { width, height } = await image.metadata();
    // Written as a negation so a missing size (NaN) is refused too.
    if (!(width * height <= MAX_IMAGE_PIXELS)) {
      throw new ImageTypeError();
    }
    // A 1x1 target keeps the memory small while the decoder still reads every row.
    await image.resize(1, 1, { fit: 'fill' }).toBuffer();
  } catch (error: unknown) {
    throw error instanceof ImageTypeError ? error : new ImageTypeError();
  }
}

/**
 * Core's upload check trusts the file name when it cannot recognise the content, so a script-bearing SVG or a text
 * file named `photo.png` is stored as an image. Every upload passes through the preview step with the stored
 * bytes, so this is where the bytes are checked against the accepted formats and decoded, whatever the client claimed.
 */
export class ContentCheckedPreviewStrategy implements AssetPreviewStrategy {
  constructor(private readonly delegate: AssetPreviewStrategy) {}

  async generatePreviewImage(ctx: RequestContext, mimeType: string, data: Buffer): Promise<Buffer> {
    if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
      if (detectImageFormat(data) === undefined) {
        throw new ImageTypeError();
      }
      await assertDecodable(data);
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
