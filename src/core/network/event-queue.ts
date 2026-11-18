export type SimEventKind = 'start' | 'deliver' | 'retry' | 'recover';

/**
 * A scheduled simulation event. The queue is ordered by `(time, seq)` and is
 * the single source of truth for what happens next — never the animation.
 */
export interface SimEvent {
  id: string;
  seq: number;
  time: number;
  kind: SimEventKind;
  proposerId?: string;
  messageId?: string;
  nodeId?: string;
}

function compareEvents(a: SimEvent, b: SimEvent): number {
  if (a.time !== b.time) return a.time - b.time;
  return a.seq - b.seq;
}

export function pushEvent(queue: SimEvent[], event: SimEvent): SimEvent[] {
  const next = [...queue, event];
  next.sort(compareEvents);
  return next;
}

export function peekEvent(queue: SimEvent[]): SimEvent | undefined {
  return queue[0];
}

export function popEvent(queue: SimEvent[]): { event: SimEvent; queue: SimEvent[] } | undefined {
  if (queue.length === 0) return undefined;
  const [event, ...rest] = queue;
  return { event, queue: rest };
}

export function hasPendingEvents(queue: SimEvent[]): boolean {
  return queue.length > 0;
}

export function nextEventTime(queue: SimEvent[]): number | null {
  return queue.length > 0 ? queue[0].time : null;
}
