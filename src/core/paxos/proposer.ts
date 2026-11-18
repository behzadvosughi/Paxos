import { compareBallots, equalBallots, formatBallot } from './ballot';
import type { Ballot, NackInfo, PromiseInfo, ProposerState } from './types';

/** Start a new attempt with the given ballot, clearing previous responses. */
export function beginBallot(proposer: ProposerState, ballot: Ballot): ProposerState {
  return {
    ...proposer,
    ballot,
    round: ballot.round,
    phase: 'preparing',
    promises: [],
    nacks: [],
    accepts: [],
    selectedValue: null,
  };
}

/** Record a promise if it belongs to the current attempt and is from a new acceptor. */
export function registerPromise(proposer: ProposerState, info: PromiseInfo): ProposerState {
  if (!proposer.ballot || !equalBallots(proposer.ballot, info.ballot)) return proposer;
  if (proposer.promises.some((promise) => promise.acceptorId === info.acceptorId)) return proposer;
  return { ...proposer, promises: [...proposer.promises, info] };
}

export function promiseCount(proposer: ProposerState): number {
  return proposer.promises.length;
}

/** True once a distinct quorum of acceptors promised this ballot. */
export function hasPromiseQuorum(proposer: ProposerState, quorum: number): boolean {
  return new Set(proposer.promises.map((promise) => promise.acceptorId)).size >= quorum;
}

/**
 * Pick the value for phase 2.
 *
 * If any promise carried a previously accepted proposal, the proposer must
 * adopt the value of the *highest* accepted ballot — never its own value. This
 * is what preserves a value that may already be chosen.
 */
export function selectProposalValue(
  proposer: ProposerState,
): { value: string; adoptedFrom: Ballot | null } {
  let best: PromiseInfo | null = null;
  for (const promise of proposer.promises) {
    if (!promise.acceptedBallot || promise.acceptedValue === null) continue;
    if (!best || !best.acceptedBallot || compareBallots(promise.acceptedBallot, best.acceptedBallot) > 0) {
      best = promise;
    }
  }
  if (best && best.acceptedValue !== null) {
    return { value: best.acceptedValue, adoptedFrom: best.acceptedBallot };
  }
  return { value: proposer.proposedValue, adoptedFrom: null };
}

export function registerNack(
  proposer: ProposerState,
  nack: { acceptorId: string; ballot: Ballot; reason: string; at: number },
): ProposerState {
  if (!proposer.ballot || !equalBallots(proposer.ballot, nack.ballot)) return proposer;
  if (proposer.nacks.some((entry) => entry.acceptorId === nack.acceptorId)) return proposer;
  const entry: NackInfo = nack;
  return { ...proposer, nacks: [...proposer.nacks, entry] };
}

/** The highest ballot seen in NACK responses — the minimum round the next attempt needs. */
export function highestNackedBallot(proposer: ProposerState): Ballot | null {
  let best: Ballot | null = null;
  for (const nack of proposer.nacks) {
    if (!best || compareBallots(nack.ballot, best) > 0) best = nack.ballot;
  }
  return best;
}

export function registerAccepted(
  proposer: ProposerState,
  info: { acceptorId: string; ballot: Ballot; value: string; at: number },
): ProposerState {
  if (!proposer.ballot || !equalBallots(proposer.ballot, info.ballot)) return proposer;
  if (proposer.accepts.some((entry) => entry.acceptorId === info.acceptorId)) return proposer;
  return { ...proposer, accepts: [...proposer.accepts, info] };
}

export function describeProposerStatus(proposer: ProposerState): string {
  switch (proposer.phase) {
    case 'idle':
      return 'Idle';
    case 'preparing':
      return `Phase 1 · Prepare ${formatBallot(proposer.ballot)}`;
    case 'accepting':
      return `Phase 2 · Accept ${formatBallot(proposer.ballot)}`;
    case 'chosen':
      return `Chosen: ${proposer.chosenValue ?? '—'}`;
    case 'retrying':
      return `Retrying with round ${proposer.round}`;
    case 'stalled':
      return 'Stalled — no quorum';
    default:
      return '—';
  }
}
