import { computed, signal } from '@angular/core';
import { statusSegments, type StatusEvent } from './chart-math';

/** Records when an async job was submitted, polled and changed status, relative to submit. */
export class JobTrace {
  readonly events = signal<StatusEvent[]>([]);
  readonly polls = signal<number[]>([]);
  private readonly endAt = signal(0);
  readonly segments = computed(() => statusSegments(this.events(), this.endAt()));
  private startedAt = 0;

  constructor(private readonly clock: () => number = () => performance.now()) {}

  start(): void {
    this.startedAt = this.clock();
    this.events.set([{ at: 0, status: 'submitted' }]);
    this.polls.set([]);
    this.endAt.set(0);
  }

  record(status: string): void {
    const at = this.clock() - this.startedAt;
    this.polls.update((polls) => [...polls, at]);
    this.events.update((events) => [...events, { at, status }]);
    this.endAt.set(at);
  }
}
