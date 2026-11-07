import { MONEY_PRECISION } from '@cod/shared';
import { DefaultMoneyStrategy } from '@vendure/core';

/** Dinar amounts are whole units: the platform stores and rounds money with no minor unit (ADR 0004). */
export class DzdMoneyStrategy extends DefaultMoneyStrategy {
  override readonly precision = MONEY_PRECISION;
}
