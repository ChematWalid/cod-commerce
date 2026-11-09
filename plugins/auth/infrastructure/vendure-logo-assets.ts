import { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { Asset, AssetService, ChannelService, isGraphQlErrorResult, type RequestContext } from '@vendure/core';
import { LogoTypeError } from '../domain/errors';
import { ImageTypeError } from './asset-content-guard';
import type { LogoAssetsPort, LogoImageFile } from '../domain/ports/logo-assets.port';
import type { OperationContext } from '../domain/ports/operation-context';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** The content guard's refusal (the file does not decode, or is too large in pixels) is a logo-type refusal here. */
function refusedAsLogoType(error: unknown): never {
  throw error instanceof ImageTypeError ? new LogoTypeError() : error;
}

/** The name every logo file starts with; the extension comes from the detected format. */
const LOGO_FILE_STEM = 'logo';

/**
 * {@link LogoAssetsPort} on Vendure's `AssetService`. The file is described by what its bytes are, not by what the
 * client said, so core's own type check sees the detected format.
 */
@Injectable()
export class VendureLogoAssets implements LogoAssetsPort {
  constructor(
    private readonly assets: AssetService,
    private readonly channels: ChannelService,
  ) {}

  async store(ctx: OperationContext, { bytes, type }: LogoImageFile): Promise<string> {
    const request = requestContextOf(ctx);
    const upload = {
      filename: `${LOGO_FILE_STEM}.${type.extension}`,
      mimetype: type.mimeType,
      encoding: '7bit',
      createReadStream: () => Readable.from([Buffer.from(bytes)], { objectMode: false }),
    };
    const created = await this.assets.create(request, { file: Promise.resolve(upload) }).catch(refusedAsLogoType);
    if (isGraphQlErrorResult(created)) {
      throw new Error(`Core refused a logo whose content was checked: ${created.message}`);
    }
    await this.leaveDefaultChannel(request, created);
    return String(created.id);
  }

  /** Core also puts a new asset on the default channel; a store's logo belongs to its own channel only. */
  private async leaveDefaultChannel(ctx: RequestContext, asset: Asset): Promise<void> {
    const defaultChannel = await this.channels.getDefaultChannel(ctx);
    if (!defaultChannel.id || defaultChannel.id === ctx.channelId) {
      return;
    }
    await this.channels.removeFromChannels(ctx, Asset, asset.id, [defaultChannel.id]);
  }
}
