import { formatBallot } from './ballot';
import type { AcceptorState } from './types';

export interface ChosenCandidate {
  ballot: AcceptorState['acceptedBallot'];
  value: string;
  count: number;
  acceptors: string[];
}

/**
 * Scan the durable acceptor state for `(ballot, value)` pairs that a quorum has
 * accepted. Consensus is derived from acceptor state only — never from the fact
 * that a proposer *sent* an Accept message.
 */
export function findQuorumValues(
  acceptors: AcceptorState[],
  quorum: number,
): ChosenCandidate[] {
  const groups = new Map<string, ChosenCandidate>();
  for (const acceptor of acceptors) {
    if (!acceptor.acceptedBallot || acceptor.acceptedValue === null) continue;
    const key = `${formatBallot(acceptor.acceptedBallot)}\u0000${acceptor.acceptedValue}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.acceptors.push(acceptor.id);
    } else {
      groups.set(key, {
        ballot: acceptor.acceptedBallot,
        value: acceptor.acceptedValue,
        count: 1,
        acceptors: [acceptor.id],
      });
    }
  }
  return [...groups.values()].filter((group) => group.count >= quorum);
}

export function detectChosen(acceptors: AcceptorState[], quorum: number): ChosenCandidate | null {
  const candidates = findQuorumValues(acceptors, quorum);
  if (candidates.length === 0) return null;
  // Prefer the candidate with the highest ballot.
  return candidates.reduce((best, candidate) => {
    if (!best || !best.ballot || !candidate.ballot) return best ?? candidate;
    return candidate.ballot.round > best.ballot.round ? candidate : best;
  }, candidates[0]);
}
