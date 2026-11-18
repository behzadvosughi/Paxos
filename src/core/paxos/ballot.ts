import type { Ballot } from './types';

/**
 * Deterministic total ordering over ballots.
 *
 * Ballots are `(round, proposerId)` tuples compared lexicographically: a higher
 * round always wins, and proposer id breaks ties so two proposers using the
 * same round can never produce equal-but-different ballots.
 */
export function compareBallots(a: Ballot, b: Ballot): number {
  if (a.round !== b.round) return a.round - b.round;
  if (a.proposerId === b.proposerId) return 0;
  return a.proposerId < b.proposerId ? -1 : 1;
}

export function equalBallots(a: Ballot | null, b: Ballot | null): boolean {
  if (a === null || b === null) return a === b;
  return compareBallots(a, b) === 0;
}

export function maxBallot(a: Ballot | null, b: Ballot | null): Ballot | null {
  if (!a) return b;
  if (!b) return a;
  return compareBallots(a, b) >= 0 ? a : b;
}

export function nextRound(ballot: Ballot): number {
  return ballot.round + 1;
}

/** Human readable proposal number, e.g. `3.P1`. */
export function formatBallot(ballot: Ballot | null): string {
  return ballot ? `${ballot.round}.${ballot.proposerId}` : '—';
}

export function ballotKey(ballot: Ballot): string {
  return `${ballot.round}\u0000${ballot.proposerId}`;
}

export function createBallot(round: number, proposerId: string): Ballot {
  return { round, proposerId };
}
