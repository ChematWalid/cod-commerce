import { useEffect, useRef, useState } from 'react';
import { fetchOAuthTicketPreview } from '../auth-operations';
import type { SetWizardValue } from './use-register-wizard';

/** A provider sign-up in progress: whether its email is fixed, and whether its ticket still works. */
export interface OAuthPrefill {
  readonly emailLocked: boolean;
  readonly invalid: boolean;
}

/** Fills the first step from the ticket. The email is fixed only when the provider confirmed it. */
export function useOAuthPrefill(ticket: string | undefined, set: SetWizardValue): OAuthPrefill {
  const [state, setState] = useState<OAuthPrefill>({ emailLocked: false, invalid: false });
  const setValue = useRef(set);
  setValue.current = set;
  useEffect(() => {
    if (ticket === undefined) return;
    fetchOAuthTicketPreview(ticket)
      .then(({ email, emailVerified, firstName, lastName }) => {
        setValue.current('email', email ?? '');
        setValue.current('firstName', firstName);
        setValue.current('lastName', lastName);
        setState({ emailLocked: emailVerified && email !== null, invalid: false });
      })
      .catch((error: unknown) => {
        console.error('The sign-up ticket could not be read', error);
        setState({ emailLocked: false, invalid: true });
      });
  }, [ticket]);
  return state;
}
