import {
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  type Signal,
} from '@angular/core';

/** Tracks the host element width as a signal; call from an injection context. */
export function observeHostWidth(fallback = 480): Signal<number> {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const width = signal(fallback);
  afterNextRender(() => {
    const observer = new ResizeObserver(([entry]) => {
      width.set(Math.round(entry.contentRect.width) || fallback);
    });
    observer.observe(host.nativeElement);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width.asReadonly();
}
