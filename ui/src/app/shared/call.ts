import { signal } from '@angular/core';
import { errorMessage } from './http';

/** State of one endpoint request: busy flag, latest value, error and elapsed time. */
export class Call<T = unknown> {
  readonly busy = signal(false);
  readonly value = signal<T | undefined>(undefined);
  readonly error = signal('');
  readonly ms = signal<number | null>(null);

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** `fn` may push interim values (stream tokens, job status) through `set`. */
  async run(fn: (set: (value: T) => void) => Promise<T | void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.value.set(undefined);
    this.ms.set(null);
    const start = this.now();
    try {
      const value = await fn((v) => this.value.set(v));
      if (value !== undefined) this.value.set(value);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.ms.set(Math.round(this.now() - start));
      this.busy.set(false);
    }
  }
}
