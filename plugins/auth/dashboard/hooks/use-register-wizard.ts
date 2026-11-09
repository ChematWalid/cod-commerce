import {
  isPlatformLanguageCode,
  registerAccountStepSchema,
  registerBusinessStepSchema,
  registerStoreStepSchema,
  AUTH_ERROR_CODES,
} from '@cod/shared';
import { useUserSettings } from '@vendure/dashboard';
import { useRef, useState } from 'react';
import { registerMerchant, type RegisterMerchantInputDto, type RegisterMerchantResultDto } from '../auth-operations';
import { DEFAULT_STORE_LANGUAGE } from '../constants';
import { errorCodeOf, errorMessageId, isSubdomainRefusal } from '../error-messages';
import { type FieldErrors, fieldErrorsOf, hasFieldErrors } from '../field-errors';

export const WIZARD_STEPS = ['account', 'business', 'store'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface WizardValues {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly businessName: string;
  readonly storeName: string;
  readonly subdomain: string;
  readonly storeLanguage: string;
  readonly logo: File | null;
}

export type SetWizardValue = <K extends keyof WizardValues>(field: K, value: WizardValues[K]) => void;

export interface RegisterWizard {
  readonly step: WizardStep;
  readonly values: WizardValues;
  readonly errors: FieldErrors;
  readonly submitting: boolean;
  readonly set: SetWizardValue;
  readonly next: () => void;
  readonly back: () => void;
  readonly submit: () => Promise<void>;
}

type OnRegistered = (result: RegisterMerchantResultDto, values: WizardValues) => void;

const INITIAL_VALUES: WizardValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  businessName: '',
  storeName: '',
  subdomain: '',
  storeLanguage: DEFAULT_STORE_LANGUAGE,
  logo: null,
};

const STEP_SCHEMAS = {
  account: registerAccountStepSchema,
  business: registerBusinessStepSchema,
  store: registerStoreStepSchema,
} as const;

/** Where a refused registration sends the merchant back to, and which field it marks. */
function refusalOf(error: unknown): { readonly step: WizardStep; readonly errors: FieldErrors } {
  const messageId = errorMessageId(error);
  const code = errorCodeOf(error);
  if (code === AUTH_ERROR_CODES.EMAIL_TAKEN || code === AUTH_ERROR_CODES.EMAIL_INVALID) {
    return { step: 'account', errors: { email: messageId } };
  }
  if (code === AUTH_ERROR_CODES.PASSWORD_POLICY) return { step: 'account', errors: { password: messageId } };
  if (isSubdomainRefusal(error)) return { step: 'store', errors: { subdomain: messageId } };
  return { step: 'store', errors: { form: messageId } };
}

function stepAfter(step: WizardStep, offset: number): WizardStep {
  return WIZARD_STEPS[WIZARD_STEPS.indexOf(step) + offset] ?? step;
}

function toRegisterInput(values: WizardValues, displayLanguage: string): RegisterMerchantInputDto {
  const { email, password, firstName, lastName, businessName, storeName, subdomain, storeLanguage } = values;
  const emailLocale = isPlatformLanguageCode(displayLanguage) ? displayLanguage : storeLanguage;
  return { email, password, firstName, lastName, businessName, storeName, subdomain, storeLanguage, emailLocale };
}

/** The three steps' state and the one submit, at the last step. */
export function useRegisterWizard(onRegistered: OnRegistered): RegisterWizard {
  const { settings } = useUserSettings();
  const [step, setStep] = useState<WizardStep>('account');
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const validateStep = (): boolean => {
    const found = fieldErrorsOf(STEP_SCHEMAS[step], values);
    setErrors(found);
    return !hasFieldErrors(found);
  };
  const submit = async (): Promise<void> => {
    if (inFlight.current || !validateStep()) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      onRegistered(await registerMerchant(toRegisterInput(values, settings.displayLanguage)), values);
    } catch (error: unknown) {
      const refusal = refusalOf(error);
      setStep(refusal.step);
      setErrors(refusal.errors);
      setSubmitting(false);
      inFlight.current = false;
    }
  };
  const set: SetWizardValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== field)));
  };
  const next = (): void => {
    if (validateStep()) setStep(stepAfter(step, 1));
  };
  const back = (): void => {
    setStep(stepAfter(step, -1));
  };
  return { step, values, errors, submitting, set, submit, next, back };
}
