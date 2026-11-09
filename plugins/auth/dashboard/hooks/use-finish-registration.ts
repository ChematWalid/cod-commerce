import { toast, useAuth } from '@vendure/dashboard';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';
import { type RegisterMerchantResultDto, saveBusinessLogo } from '../auth-operations';
import { HOME_PATH, IMAGE_SAVE_FAILED_MESSAGE_ID, LOGIN_PATH, SIGN_IN_AFTER_REGISTER_MESSAGE_ID } from '../constants';
import { useOAuthSignIn } from './use-oauth-sign-in';
import type { WizardValues } from './use-register-wizard';

export type NavigateTo = (options: { readonly to: string }) => unknown;

type SaveLogo = (logo: File | null, storeId: string) => Promise<unknown>;

/**
 * True from the created account until the login and logo are done. Module state on purpose: the dashboard unmounts
 * its router while `auth.status` is `verifying`, so component state would be lost mid-login and the fresh page would
 * redirect Home before the logo is saved, or show an empty wizard if the login failed. `throughProvider` stops the
 * "no session yet" check: a provider sign-up is still unauthenticated while its ticket is being spent.
 */
const finishing = { active: false, throughProvider: false };

function endFinishing(): void {
  finishing.active = false;
  finishing.throughProvider = false;
}

/** Spends the sign-in ticket of a provider sign-up, which has no password to log in with, and goes Home. */
function useFinishThroughProvider(
  navigate: NavigateTo,
  saveLogo: SaveLogo,
): (ticket: string, storeId: string, logo: File | null) => void {
  const { i18n } = useLingui();
  const auth = useAuth();
  const signIn = useOAuthSignIn();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!signedIn || !auth.isAuthenticated) return;
    endFinishing();
    void navigate({ to: HOME_PATH });
  }, [signedIn, auth.isAuthenticated, navigate]);
  return (ticket, storeId, logo) => {
    finishing.throughProvider = true;
    signIn(ticket)
      .then(() => saveLogo(logo, storeId))
      .then(() => {
        setSignedIn(true);
      })
      .catch((error: unknown) => {
        console.error('Signing in after a provider sign-up failed', error);
        endFinishing();
        toast.error(i18n._(SIGN_IN_AFTER_REGISTER_MESSAGE_ID));
        void navigate({ to: LOGIN_PATH });
      });
  };
}

/**
 * Logs the new account in and finishes the sign-up. The account exists from here on, so a logo problem only
 * warns (D34), and a failed login sends the merchant to sign in rather than back into a form that would refuse.
 */
export function useFinishRegistration(navigate: NavigateTo): {
  readonly created: boolean;
  readonly finish: (result: RegisterMerchantResultDto, values: WizardValues) => void;
} {
  const { i18n } = useLingui();
  const auth = useAuth();
  const [created, setCreated] = useState(finishing.active);
  const saveLogo: SaveLogo = (logo, storeId) =>
    (logo === null ? Promise.resolve() : saveBusinessLogo(logo, storeId)).catch(() =>
      toast.error(i18n._(IMAGE_SAVE_FAILED_MESSAGE_ID)),
    );
  const finishThroughProvider = useFinishThroughProvider(navigate, saveLogo);
  useEffect(() => {
    if (!finishing.active || finishing.throughProvider || auth.status !== 'unauthenticated') return;
    finishing.active = false;
    toast.error(i18n._(SIGN_IN_AFTER_REGISTER_MESSAGE_ID));
    void navigate({ to: LOGIN_PATH });
  }, [auth.status, i18n, navigate]);
  const finish = ({ storeId, signInTicket }: RegisterMerchantResultDto, values: WizardValues): void => {
    finishing.active = true;
    setCreated(true);
    if (signInTicket !== null) {
      finishThroughProvider(signInTicket, storeId, values.logo);
      return;
    }
    auth.login(values.email, values.password, () => {
      void saveLogo(values.logo, storeId).finally(() => {
        finishing.active = false;
        void navigate({ to: HOME_PATH });
      });
    });
  };
  return { created, finish };
}
