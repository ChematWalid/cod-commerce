import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { SETTINGS_ERROR_TEST_ID } from '../constants';

interface SettingsCardFooterProps {
  readonly saveTestId: string;
  readonly canSave: boolean;
  readonly saving: boolean;
  /** The catalogue id of the server's refusal, when the last save failed. */
  readonly errorId: string | undefined;
}

/** The save button and the refusal of one settings card. Rendered only for someone who may edit. */
export function SettingsCardFooter({ saveTestId, canSave, saving, errorId }: SettingsCardFooterProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" data-testid={saveTestId} disabled={!canSave || saving}>
        {i18n._('shell.settings.save')}
      </Button>
      {errorId !== undefined && (
        <p role="alert" data-testid={SETTINGS_ERROR_TEST_ID} className="text-destructive min-w-0 text-sm">
          {i18n._(errorId)}
        </p>
      )}
    </div>
  );
}
