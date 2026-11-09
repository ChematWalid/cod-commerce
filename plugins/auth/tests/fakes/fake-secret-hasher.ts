import type { SecretHasherPort } from '../../domain/ports/secret-hasher.port';

/** Readable secrets and hashes; counts comparisons. */
export class FakeSecretHasher implements SecretHasherPort {
  comparisons = 0;
  private issued = 0;

  newToken(): string {
    this.issued += 1;
    return `token-${String(this.issued)}`;
  }

  newOtp(): string {
    this.issued += 1;
    return String(100_000 + this.issued);
  }

  hash(secret: string): string {
    return `hash(${secret})`;
  }

  matches(secret: string, expectedHash: string): boolean {
    this.comparisons += 1;
    return this.hash(secret) === expectedHash;
  }
}
