import { type DeliveryMethod, WILAYA_CODES, type WilayaCode } from '@cod/shared';

/** The free-delivery card's method choice; both methods is stored as the empty list, "every method" (D2420). */
export type DeliveryChoice = 'both' | 'home' | 'desk';

const METHODS_OF_CHOICE: Readonly<Record<DeliveryChoice, readonly DeliveryMethod[]>> = {
  both: [],
  home: ['home'],
  desk: ['desk'],
};

/** The eligibility methods of a choice. */
export const deliveryMethodsOf = (choice: DeliveryChoice): DeliveryMethod[] => [...METHODS_OF_CHOICE[choice]];

/** The choice a stored method list reads as: one method is that method, none or both is both. */
export function deliveryChoiceOf(methods: readonly DeliveryMethod[]): DeliveryChoice {
  const [only] = methods;
  return methods.length === 1 && only !== undefined ? only : 'both';
}

/** The wilaya list after ticking or unticking `code`, in code order. */
export function toggleWilaya(wilayas: readonly WilayaCode[], code: WilayaCode, on: boolean): WilayaCode[] {
  return WILAYA_CODES.filter((each) => (each === code ? on : wilayas.includes(each)));
}
