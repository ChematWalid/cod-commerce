import { Injectable } from '@nestjs/common';
import { GetPackService } from '../application/get-pack.service';
import { PreviewPackService } from '../application/preview-pack.service';
import { SavePackService } from '../application/save-pack.service';

/** The pack use cases, injected together. */
@Injectable()
export class PackUseCases {
  constructor(
    readonly saving: SavePackService,
    readonly getting: GetPackService,
    readonly previewing: PreviewPackService,
  ) {}
}
