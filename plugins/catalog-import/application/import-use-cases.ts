import type { AnalyzeImportService } from './analyze-import.service';
import type { ConfirmImportService } from './confirm-import.service';
import type { CreateUploadService } from './create-upload.service';
import type { ImportStatusService } from './import-status.service';
import type { PreviewImportService } from './preview-import.service';

/** The steps of a spreadsheet import (D2210), each its own use case. */
export interface ImportSteps {
  readonly uploads: CreateUploadService;
  readonly analyses: AnalyzeImportService;
  readonly previews: PreviewImportService;
  readonly confirms: ConfirmImportService;
  readonly statuses: ImportStatusService;
}

/** The import's use cases as one injectable, so the API's action class takes one dependency for all its steps. */
export class ImportUseCases {
  constructor(readonly steps: ImportSteps) {}
}
