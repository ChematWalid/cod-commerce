import { PRODUCT_NAME } from '@cod/shared';
import { Card, CardContent, LoginBranding, useUserSettings } from '@vendure/dashboard';
import type { PropsWithChildren, ReactNode } from 'react';
import { PUBLIC_PAGE_LANGUAGES } from '../constants';

function LanguageSwitch(): ReactNode {
  const { settings, setDisplayLanguage } = useUserSettings();
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      {PUBLIC_PAGE_LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={settings.displayLanguage === code}
          className="text-muted-foreground hover:text-foreground aria-pressed:text-foreground aria-pressed:font-medium"
          onClick={() => {
            setDisplayLanguage(code);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The frame of the public accept page, as the sign-in pages look: our brand, a card, the language switch and the
 * licence-required footer (ADR 0001). Auth's own frame is internal to that plugin, so Team draws the same one.
 */
export function PublicFrame({ children }: PropsWithChildren): ReactNode {
  return (
    <div className="bg-sidebar flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 md:max-w-md">
        <span className="text-2xl font-bold tracking-tight">{PRODUCT_NAME}</span>
        <Card className="w-full">
          <CardContent>{children}</CardContent>
        </Card>
        <LanguageSwitch />
      </div>
      <LoginBranding />
    </div>
  );
}
