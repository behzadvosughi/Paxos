import { createRngState } from '../network/rng';
import { pushEvent, type SimEvent } from '../network/event-queue';
import type { Message } from '../network/message';

import { quorumSize } from '../paxos/quorum';
import type {
  AcceptorState,
  Ballot,
  LearnerState,
  MessageType,
  NodeRole,
  NodeStatus,
  ProposerState,
} from '../paxos/types';

export interface SimulationConfig {
  acceptorCount: number;
  proposerCount: number;
  learnerCount: number;
  /** base one-way latency in virtual milliseconds */
  latency: number;
  /** additional random delay (0..packetDelay) */
  packetDelay: number;
  /** 0..1 probability that a packet is lost */
  packetLoss: number;
  /** first round used by every proposer */
  proposalRound: number;
  proposedValue: string;
  /** PRNG seed — identical seed + config reproduces a run exactly */
  seed: number;
  autoRetry: boolean;
  retryDelay: number;
  /** delay between proposer start events, creates genuine contention */
  startStagger: number;
  recoveryDelay: number;
  /** intentionally unsafe experiment: drop durable state on recovery */
  unsafeRecover: boolean;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  acceptorCount: 3,
  proposerCount: 1,
  learnerCount: 1,
  latency: 120,
  packetDelay: 60,
  packetLoss: 0,
  proposalRound: 1,
  proposedValue: 'alpha',
  seed: 42,
  autoRetry: true,
  retryDelay: 600,
  startStagger: 220,
  recoveryDelay: 320,
  unsafeRecover: false,
};

export type LogKind =
  | 'prepare'
  | 'promise'
  | 'accept'
  | 'accepted'
  | 'nack'
  | 'quorum'
  | 'chosen'
  | 'retry'
  | 'drop'
  | 'crash'
  | 'recover'
  | 'partition'
  | 'link'
  | 'system';

export interface LogEntry {
  id: string;
  time: number;
  kind: LogKind;
  nodeId: string | null;
  packetId: string | null;
  title: string;
  description: string;
  /** why it happened, in plain language */
  explanation: string;
}

export interface SimulationState {
  config: SimulationConfig;
  virtualTime: number;
  rngState: number;
  nextMessageId: number;
  nextEventSeq: number;
  nextLogId: number;
  proposers: ProposerState[];
  acceptors: AcceptorState[];
  learners: LearnerState[];
  messages: Message[];
  queue: SimEvent[];
  log: LogEntry[];
  chosen: { ballot: Ballot; value: string; at: number } | null;
  safetyViolation: string | null;
  disabledLinks: string[];
  partitionEnabled: boolean;
  partitionGroupA: string[];
  quorum: number;
  stats: { sent: number; delivered: number; dropped: number; events: number };
}

export function valueForProposer(index: number, base: string): string {
  if (index === 0) return base;
  return `${base}-${String.fromCharCode(65 + index)}`;
}

export function createInitialState(config: SimulationConfig): SimulationState {
  const acceptors: AcceptorState[] = Array.from({ length: config.acceptorCount }, (_, index) => ({
    id: `A${index + 1}`,
    role: 'acceptor',
    status: 'active',
    promisedBallot: null,
    acceptedBallot: null,
    acceptedValue: null,
    received: [],
    sent: [],
  }));

  const proposers: ProposerState[] = Array.from({ length: config.proposerCount }, (_, index) => ({
    id: `P${index + 1}`,
    role: 'proposer',
    status: 'active',
    proposedValue: valueForProposer(index, config.proposedValue),
    round: config.proposalRound,
    ballot: null,
    phase: 'idle',
    promises: [],
    nacks: [],
    accepts: [],
    selectedValue: null,
    chosenValue: null,
    retries: 0,
  }));

  const learners: LearnerState[] = Array.from({ length: config.learnerCount }, (_, index) => ({
    id: `L${index + 1}`,
    role: 'learner',
    status: 'active',
    received: [],
    chosenValue: null,
    chosenBallot: null,
  }));

  // Split the network so that the proposer side plus half of the acceptors sit
  // on one side of the partition. The remaining acceptors then cannot form a
  // quorum, which is exactly the lesson a partition should teach.
  const sideAAcceptors = Math.max(1, Math.floor(config.acceptorCount / 2));

  let state: SimulationState = {
    config: { ...config },
    virtualTime: 0,
    rngState: createRngState(config.seed),
    nextMessageId: 1,
    nextEventSeq: 1,
    nextLogId: 1,
    proposers,
    acceptors,
    learners,
    messages: [],
    queue: [],
    log: [],
    chosen: null,
    safetyViolation: null,
    disabledLinks: [],
    partitionEnabled: false,
    partitionGroupA: [
      ...proposers.map((p) => p.id),
      ...acceptors.slice(0, sideAAcceptors).map((a) => a.id),
    ],
    quorum: quorumSize(config.acceptorCount),
    stats: { sent: 0, delivered: 0, dropped: 0, events: 0 },
  };

  // Kick-off events, one per proposer.
  proposers.forEach((proposer, index) => {
    state = schedule(state, {
      time: index * config.startStagger,
      kind: 'start',
      proposerId: proposer.id,
    });
  });

  return state;
}

/** Schedule an event on a state, returning the new queue (immutably). */
export function schedule(
  state: SimulationState,
  event: Omit<SimEvent, 'id' | 'seq'>,
): SimulationState {
  const simEvent: SimEvent = {
    ...event,
    id: `e${state.nextEventSeq}`,
    seq: state.nextEventSeq,
  };
  return {
    ...state,
    nextEventSeq: state.nextEventSeq + 1,
    queue: pushEvent(state.queue, simEvent),
  };
}

export function findProposer(state: SimulationState, id: string): ProposerState | undefined {
  return state.proposers.find((proposer) => proposer.id === id);
}

export function findAcceptor(state: SimulationState, id: string): AcceptorState | undefined {
  return state.acceptors.find((acceptor) => acceptor.id === id);
}

export function findLearner(state: SimulationState, id: string): LearnerState | undefined {
  return state.learners.find((learner) => learner.id === id);
}

export function findNodeStatus(
  state: SimulationState,
  id: string,
): { status: NodeStatus; role: NodeRole } | null {
  const proposer = findProposer(state, id);
  if (proposer) return { status: proposer.status, role: proposer.role };
  const acceptor = findAcceptor(state, id);
  if (acceptor) return { status: acceptor.status, role: acceptor.role };
  const learner = findLearner(state, id);
  if (learner) return { status: learner.status, role: learner.role };
  return null;
}

export function isMessageType(value: string): value is MessageType {
  return ['prepare', 'promise', 'accept', 'accepted', 'nack'].includes(value);
}
