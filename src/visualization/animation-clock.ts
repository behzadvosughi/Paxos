/**
 * The animation clock is intentionally *separate* from the simulation state.
 *
 * The protocol advances only when an event is processed; this clock merely
 * interpolates packet positions between the `sentAt` and `arriveAt` timestamps
 * recorded by the simulation. Playback is therefore pure presentation and can
 * never change protocol behavior.
 */
let current = 0;
let rafId: number | null = null;
const listeners = new Set<(time: number) => void>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

export function getAnimationTime(): number {
  return current;
}

export function cancelAnimation(): void {
  if (rafId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafId);
  }
  rafId = null;
}

export function setAnimationTime(time: number): void {
  cancelAnimation();
  current = time;
  emit();
}

/** Smoothly move the display clock; used when stepping one event at a time. */
export function animateTo(target: number, duration = 340): void {
  cancelAnimation();
  if (typeof requestAnimationFrame !== 'function' || duration <= 0) {
    current = target;
    emit();
    return;
  }
  const from = current;
  const start = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) * (1 - progress);
    current = from + (target - from) * eased;
    emit();
    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
    }
  };
  rafId = requestAnimationFrame(step);
}

export function subscribeAnimationClock(listener: (time: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
