import type { PricingLogger } from '../../domain/ports/pricing-logger.port';

/** A pricing logger that keeps what it was told, so a test can check an operator report. */
export class RecordingPricingLogger implements PricingLogger {
  readonly unknownKinds: { offerId: string; kind: string }[] = [];
  readonly unknownTargets: { offerId: string; refType: string; role: string }[] = [];

  unknownKind(offerId: string, kind: string): void {
    this.unknownKinds.push({ offerId, kind });
  }

  unknownTarget(offerId: string, refType: string, role: string): void {
    this.unknownTargets.push({ offerId, refType, role });
  }
}
