import type { ImageFormat } from '../image-format';
import type { OperationContext } from './operation-context';

/** A checked logo image, ready to be stored. */
export interface LogoImageFile {
  readonly bytes: Uint8Array;
  readonly type: ImageFormat;
}

/** Stores logos as assets of the request's store channel. */
export interface LogoAssetsPort {
  /** @returns the new asset's id, as a string like every id at an API boundary. */
  store(ctx: OperationContext, file: LogoImageFile): Promise<string>;
}
