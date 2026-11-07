import type { Port } from '../application/port';

export class Repo implements Port {
  save(): Promise<void> {
    return Promise.resolve();
  }
}
