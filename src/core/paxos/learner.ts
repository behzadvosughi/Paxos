import { equalBallots } from './ballot';
import type { Ballot, LearnerState } from './types';

/**
 * Learners are passive: they collect `accepted` notifications and declare a
 * value chosen only after a quorum of acceptors reported the same
 * `(ballot, value)` pair.
 */
export function recordAccepted(
  learner: LearnerState,
  info: { from: string; ballot: Ballot; value: string; at: number },
  quorum: number,
): LearnerState {
  const received = [
    ...learner.received,
    {
      type: 'accepted' as const,
      peer: info.from,
      ballot: info.ballot,
      value: info.value,
      at: info.at,
    },
  ].slice(-40);

  const tally = new Map<string, number>();
  for (const entry of received) {
    if (!entry.ballot || entry.value === null) continue;
    if (!equalBallots(entry.ballot, info.ballot)) continue;
    const key = entry.peer;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  const distinct = tally.size;
  if (distinct >= quorum) {
    return {
      ...learner,
      received,
      chosenValue: info.value,
      chosenBallot: info.ballot,
    };
  }

  return { ...learner, received };
}
