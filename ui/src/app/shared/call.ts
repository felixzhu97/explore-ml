import { signal } from '@angular/core';
import { errorMessage } from './error-message';

/** State of one endpoint request: busy flag, latest value, error and elapsed time. */
export class Call<T = unknown> {
  readonly busy = signal(false);
  readonly value = signal<T | undefined>(undefined);
  readonly error = signal('');
  readonly elapsedMs = signal<number | null>(null);

  constructor(private readonly clock: () => number = () => performance.now()) {}

  /** `request` may push interim values (stream tokens, job status) through `setValue`. */
  async run(request: (setValue: (value: T) => void) => Promise<T | void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.value.set(undefined);
    this.elapsedMs.set(null);
    const startedAt = this.clock();
    try {
      const result = await request((interimValue) => this.value.set(interimValue));
      if (result !== undefined) this.value.set(result);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.elapsedMs.set(Math.round(this.clock() - startedAt));
      this.busy.set(false);
    }
  }
}
