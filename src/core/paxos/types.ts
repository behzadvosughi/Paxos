/**
 * Shared protocol-level types.
 *
 * These types are deliberately free of any React, DOM or animation concerns so
 * the protocol can be reasoned about (and unit tested) on its own.
 */

/** A Paxos ballot: `(round, proposerId)`. Ordered lexicographically. */
export interface Ballot {
  round: number;
  proposerId: string;
}

export type NodeRole = 'proposer' | 'acceptor' | 'learner';

/**
 * `unavailable` is derived at runtime (a node cut off by a partition is shown
 * as unavailable even though its durable state is intact).
 */
export type NodeStatus = 'active' | 'crashed' | 'unavailable' | 'recovering';

export type MessageType = 'prepare' | 'promise' | 'accept' | 'accepted' | 'nack';

export type PacketStatus = 'inflight' | 'delivered' | 'dropped';

export interface MessageSummary {
  type: MessageType;
  peer: string;
  ballot: Ballot | null;
  value: string | null;
  at: number;
}

export interface PromiseInfo {
  acceptorId: string;
  /** ballot the promise was made for */
  ballot: Ballot;
  /** the acceptor's previously accepted ballot/value, if any */
  acceptedBallot: Ballot | null;
  acceptedValue: string | null;
  at: number;
}

export interface NackInfo {
  acceptorId: string;
  ballot: Ballot;
  reason: string;
  at: number;
}

export interface AcceptInfo {
  acceptorId: string;
  ballot: Ballot;
  value: string;
  at: number;
}

export type ProposerPhase =
  | 'idle'
  | 'preparing'
  | 'accepting'
  | 'chosen'
  | 'retrying'
  | 'stalled';

export interface ProposerState {
  id: string;
  role: 'proposer';
  status: NodeStatus;
  /** the value this proposer was configured to propose */
  proposedValue: string;
  /** the highest round this proposer has attempted */
  round: number;
  ballot: Ballot | null;
  phase: ProposerPhase;
  promises: PromiseInfo[];
  nacks: NackInfo[];
  accepts: AcceptInfo[];
  /** value the proposer decided on after inspecting promises */
  selectedValue: string | null;
  chosenValue: string | null;
  retries: number;
}

export interface AcceptorState {
  id: string;
  role: 'acceptor';
  status: NodeStatus;
  promisedBallot: Ballot | null;
  acceptedBallot: Ballot | null;
  acceptedValue: string | null;
  received: MessageSummary[];
  sent: MessageSummary[];
}

export interface LearnerState {
  id: string;
  role: 'learner';
  status: NodeStatus;
  received: MessageSummary[];
  chosenValue: string | null;
  chosenBallot: Ballot | null;
}

export type AnyNode = ProposerState | AcceptorState | LearnerState;
