import { describe, expect, it } from 'vitest';
import {
  confirmAllowed,
  initialWizard,
  jobPollInterval,
  mappingOf,
  previousStep,
  uploadFormatOf,
  withAnalyzed,
  withConfirmed,
  withPreviewed,
  withReviewed,
  type WizardState,
} from '../../dashboard/model/wizard';
import { JOB_POLL_INTERVAL_MS } from '../../dashboard/constants';

const analyzed = withAnalyzed(initialWizard(), 'imp-1');

describe('import wizard', () => {
  it('steps go upload → mapping → preview → confirm and back only before confirm', () => {
    // Arrange
    const steps: WizardState[] = [initialWizard()];

    // Act
    steps.push(analyzed);
    steps.push(withPreviewed(analyzed));
    steps.push(withReviewed(withPreviewed(analyzed)));
    const confirmed = withConfirmed(steps[3] as WizardState);

    // Assert
    expect(steps.map((state) => state.step)).toEqual(['upload', 'mapping', 'preview', 'confirm']);
    expect(previousStep(steps[0] as WizardState)).toBeNull();
    expect(previousStep(steps[1] as WizardState)?.step).toBe('upload');
    expect(previousStep(steps[2] as WizardState)?.step).toBe('mapping');
    expect(previousStep(steps[3] as WizardState)?.step).toBe('preview');
    expect(confirmed.confirmed).toBe(true);
    expect(previousStep(confirmed)).toBeNull();
  });

  it('back from mapping to upload forgets the uploaded file', () => {
    // Act
    const back = previousStep(analyzed);

    // Assert
    expect(back).toEqual(initialWizard());
  });

  it('confirm disabled while counts show 0 valid rows', () => {
    // Arrange
    const onlyErrors = { creates: 0, updates: 0, errors: 3, warnings: 1 };
    const oneCreate = { creates: 1, updates: 0, errors: 3, warnings: 0 };
    const oneUpdate = { creates: 0, updates: 1, errors: 0, warnings: 0 };

    // Act / Assert
    expect(confirmAllowed(null)).toBe(false);
    expect(confirmAllowed(onlyErrors)).toBe(false);
    expect(confirmAllowed(oneCreate)).toBe(true);
    expect(confirmAllowed(oneUpdate)).toBe(true);
  });

  it('polls the job until done or failed', () => {
    // Act
    const intervals = ['awaiting_upload', 'confirming', 'running', 'queued', 'done', 'failed', undefined].map(
      jobPollInterval,
    );

    // Assert
    expect(intervals).toEqual([
      JOB_POLL_INTERVAL_MS,
      JOB_POLL_INTERVAL_MS,
      JOB_POLL_INTERVAL_MS,
      JOB_POLL_INTERVAL_MS,
      false,
      false,
      JOB_POLL_INTERVAL_MS,
    ]);
  });

  it('maps each column to the field the server guessed', () => {
    // Arrange
    const columns = [
      { column: 0, header: 'Name', field: 'name', warning: null },
      { column: 1, header: 'Colour', field: null, warning: 'catalog-import.warn-unknown-column' },
    ];

    // Act
    const mapping = mappingOf(columns);

    // Assert
    expect(mapping).toEqual([
      { column: 0, field: 'name' },
      { column: 1, field: null },
    ]);
  });

  it('reads the format from the file name and refuses others', () => {
    // Act / Assert
    expect(uploadFormatOf('Products.XLSX')).toBe('xlsx');
    expect(uploadFormatOf('products.csv')).toBe('csv');
    expect(uploadFormatOf('products.xls')).toBeNull();
    expect(uploadFormatOf('csv')).toBeNull();
  });
});
