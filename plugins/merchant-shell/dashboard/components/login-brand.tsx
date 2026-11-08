import { PRODUCT_NAME } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { LOGIN_BRAND_TEST_ID } from '../constants';

/** Replaces the stock logo on the login page (ADR 0007). */
export function LoginBrand(): ReactNode {
  return (
    <span data-testid={LOGIN_BRAND_TEST_ID} className="text-2xl font-bold tracking-tight">
      {PRODUCT_NAME}
    </span>
  );
}

/** Replaces the stock welcome block of the login form. */
export function LoginWelcome(): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{i18n._('Welcome to {name}', { name: PRODUCT_NAME })}</h1>
      <p className="text-muted-foreground text-sm">{i18n._('Sign in to manage your store')}</p>
    </div>
  );
}
