import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { DefaultAssetNamingStrategy, type RequestContext } from '@vendure/core';

/** Random bytes of a stored file's name: 128 bits, so a name can be neither guessed nor met twice. */
const NAME_BYTES = 16;
/** Leading name characters that become a sub-directory, as `HashedAssetNamingStrategy` does, to spread the keys. */
const DIRECTORY_LENGTH = 2;
const MAX_EXTENSION_LENGTH = 5;
const SAFE_EXTENSION = /^\.[a-z0-9]+$/;

/**
 * Names every stored file at random. The client's file name is never part of a key, so URLs cannot be enumerated
 * and two uploads cannot overwrite each other. With a collision-free name core's "is this name taken" loop ends
 * after one lookup.
 */
export class RandomAssetNamingStrategy extends DefaultAssetNamingStrategy {
  override generateSourceFileName(_ctx: RequestContext, originalFileName: string): string {
    const name = randomBytes(NAME_BYTES).toString('hex');
    return path.posix.join('source', name.slice(0, DIRECTORY_LENGTH), `${name}${this.safeExtension(originalFileName)}`);
  }

  /** `sourceFileName` is the stored source name, so the preview takes its random part. */
  override generatePreviewFileName(ctx: RequestContext, sourceFileName: string): string {
    const base = path.posix.basename(sourceFileName);
    const preview = super.generatePreviewFileName(ctx, base);
    return path.posix.join('preview', base.slice(0, DIRECTORY_LENGTH), preview);
  }

  private safeExtension(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    return SAFE_EXTENSION.test(extension) && extension.length <= MAX_EXTENSION_LENGTH + 1 ? extension : '';
  }
}
