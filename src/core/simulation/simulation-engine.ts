import type { EventText } from '../i18n/events';
import { ev } from '../i18n/events';
import type { ReasonInfo } from '../i18n/reason';
import {
  LINK_DISABLED,
  PARTITIONED,
  linkBlockReason,
  planTransmission,
} from '../network/network-engine';
import { popEvent, pushEvent, type SimEvent } from '../network/event-queue';
import type { Message } from '../network/message';
import { isNackReply, onAccept, onPrepare } from '../paxos/acceptor';
import { createBallot, equalBallots, formatBallot } from '../paxos/ballot';
import { recordAccepted } from '../paxos/learner';
import {
  beginBallot,
  hasPromiseQuorum,
  highestNackedBallot,
  promiseCount,
  registerAccepted,
  registerNack,
  registerPromise,
  selectProposalValue,
} from '../paxos/proposer';
import { findQuorumValues } from '../paxos/protocol-engine';
import type {
  AcceptorState,
  Ballot,
  LearnerState,
  MessageSummary,
  MessageType,
  NodeStatus,
  ProposerState,
} from '../paxos/types';
import { peekEvent } from '../network/event-queue';
import {
  findAcceptor,
  findLearner,
  findProposer,
  type LogKind,
  type SimulationState,
} from './simulation-state';

/* ------------------------------------------------------------------ *
 * Small internal helpers
 * ------------------------------------------------------------------ */

function cloneState(state: SimulationState): SimulationState {
  return structuredClone(state);
}

function log(
  draft: SimulationState,
  entry: {
    time: number;
    kind: LogKind;
    nodeId?: string | null;
    packetId?: string | null;
    title: string;
    description: EventText;
    explanation: EventText;
  },
): void {
  draft.log.push({
    id: `log-${draft.nextLogId}`,
    time: entry.time,
    kind: entry.kind,
    nodeId: entry.nodeId ?? null,
    packetId: entry.packetId ?? null,
    title: entry.title,
    description: entry.description,
    explanation: entry.explanation,
  });
  draft.nextLogId += 1;
}

function enqueue(
  draft: SimulationState,
  event: Omit<SimEvent, 'id' | 'seq'>,
): SimEvent {
  const simEvent: SimEvent = {
    ...event,
    id: `e${draft.nextEventSeq}`,
    seq: draft.nextEventSeq,
  };
  draft.nextEventSeq += 1;
  draft.queue = pushEvent(draft.queue, simEvent);
  return simEvent;
}

function setProposer(draft: SimulationState, proposer: ProposerState): void {
  draft.proposers = draft.proposers.map((entry) => (entry.id === proposer.id ? proposer : entry));
}

function setAcceptor(draft: SimulationState, acceptor: AcceptorState): void {
  draft.acceptors = draft.acceptors.map((entry) => (entry.id === acceptor.id ? acceptor : entry));
}

function setLearner(draft: SimulationState, learner: LearnerState): void {
  draft.learners = draft.learners.map((entry) => (entry.id === learner.id ? learner : entry));
}

function nodeStatusOf(state: SimulationState, id: string): NodeStatus | null {
  return (
    findProposer(state, id)?.status ??
    findAcceptor(state, id)?.status ??
    findLearner(state, id)?.status ??
    null
  );
}

function setNodeStatus(state: SimulationState, id: string, status: NodeStatus): void {
  const proposer = findProposer(state, id);
  if (proposer) {
    setProposer(state, { ...proposer, status });
    return;
  }
  const acceptor = findAcceptor(state, id);
  if (acceptor) {
    setAcceptor(state, { ...acceptor, status });
    return;
  }
  const learner = findLearner(state, id);
  if (learner) setLearner(state, { ...learner, status });
}

function recordReceived(
  draft: SimulationState,
  id: string,
  summary: MessageSummary,
): void {
  const acceptor = findAcceptor(draft, id);
  if (acceptor) {
    setAcceptor(draft, { ...acceptor, received: [...acceptor.received, summary].slice(-24) });
    return;
  }
  const learner = findLearner(draft, id);
  if (learner) {
    setLearner(draft, { ...learner, received: [...learner.received, summary].slice(-40) });
  }
}

function recordSent(draft: SimulationState, id: string, summary: MessageSummary): void {
  const acceptor = findAcceptor(draft, id);
  if (!acceptor) return;
  setAcceptor(draft, { ...acceptor, sent: [...acceptor.sent, summary].slice(-24) });
}

interface SendPayload {
  ballot: Ballot;
  value?: string | null;
  acceptedBallot?: Ballot | null;
  acceptedValue?: string | null;
  reason?: ReasonInfo | null;
}

/**
 * Create a packet and either schedule its delivery or mark it dropped.
 * All randomness is consumed here, from the state's PRNG stream, so a restored
 * snapshot reproduces the exact same network behaviour.
 */
function send(
  draft: SimulationState,
  type: MessageType,
  from: string,
  to: string,
  payload: SendPayload,
): Message {
  const blocked = linkBlockReason(
    from,
    to,
    draft.disabledLinks,
    draft.partitionEnabled,
    draft.partitionGroupA,
  );
  const plan = planTransmission({
    now: draft.virtualTime,
    latency: draft.config.latency,
    jitter: draft.config.packetDelay,
    packetLoss: draft.config.packetLoss,
    rngState: draft.rngState,
    blockedReason: blocked,
  });
  draft.rngState = plan.rngState;

  const message: Message = {
    id: `m${draft.nextMessageId}`,
    type,
    from,
    to,
    ballot: payload.ballot,
    value: payload.value ?? null,
    acceptedBallot: payload.acceptedBallot ?? null,
    acceptedValue: payload.acceptedValue ?? null,
    reason: payload.reason ?? null,
    sentAt: draft.virtualTime,
    arriveAt: plan.arriveAt,
    status: plan.dropped ? 'dropped' : 'inflight',
    dropAt: plan.dropAt,
    dropReason: plan.reason,
  };
  draft.nextMessageId += 1;
  draft.messages.push(message);
  draft.stats.sent += 1;
  if (draft.messages.length > 600) {
    draft.messages.splice(0, draft.messages.length - 600);
  }

  if (plan.dropped) {
    draft.stats.dropped += 1;
    log(draft, {
      time: draft.virtualTime,
      kind: 'drop',
      nodeId: from,
      packetId: message.id,
      title: plan.reason?.code === 'packetLoss' ? 'Packet lost' : 'Packet blocked',
      description: ev('dropBlocked', {
        from,
        to,
        message: type,
        ballot: formatBallot(payload.ballot),
        reason: { reason: plan.reason ?? { code: 'rejected' } },
      }),
      explanation: ev(
        plan.reason?.code === 'packetLoss'
          ? 'packetLossExpl'
          : plan.reason?.code === 'partition'
            ? 'partitionDropExpl'
            : 'linkDropExpl',
      ),
    });
  } else {
    enqueue(draft, { time: plan.arriveAt, kind: 'deliver', messageId: message.id });
  }

  return message;
}

function dropDelivered(draft: SimulationState, message: Message, reason: ReasonInfo): void {
  message.status = 'dropped';
  message.dropAt = draft.virtualTime;
  message.dropReason = reason;
  draft.stats.dropped += 1;
  log(draft, {
    time: draft.virtualTime,
    kind: 'drop',
    nodeId: message.to,
    packetId: message.id,
    title: 'Delivery failed',
    description: ev('deliveryFailed', {
      message: message.type,
      from: message.from,
      to: message.to,
      reason: { reason },
    }),
    explanation: ev('deliveryFailedExpl'),
  });
}

/* ------------------------------------------------------------------ *
 * Chosen-value detection
 * ------------------------------------------------------------------ */

function updateChosen(draft: SimulationState): void {
  const candidates = findQuorumValues(draft.acceptors, draft.quorum);
  for (const candidate of candidates) {
    if (!candidate.ballot) continue;
    if (!draft.chosen) {
      draft.chosen = {
        ballot: candidate.ballot,
        value: candidate.value,
        at: draft.virtualTime,
      };
      const owner = draft.proposers.find(
        (proposer) => proposer.ballot && equalBallots(proposer.ballot, candidate.ballot),
      );
      if (owner) {
        setProposer(draft, { ...owner, phase: 'chosen', chosenValue: candidate.value });
      }
      log(draft, {
        time: draft.virtualTime,
        kind: 'chosen',
        nodeId: candidate.acceptors[0] ?? null,
        title: 'Chosen',
        description: ev('chosen', {
          count: candidate.count,
          total: draft.acceptors.length,
          value: candidate.value,
          ballot: formatBallot(candidate.ballot),
          quorum: draft.quorum,
        }),
        explanation: ev('chosenExpl'),
      });
    } else if (draft.chosen.value !== candidate.value) {
      draft.safetyViolation = { first: draft.chosen.value, second: candidate.value };
      log(draft, {
        time: draft.virtualTime,
        kind: 'system',
        title: 'Safety violation',
        description: ev('safetyViolation', {
          first: draft.chosen.value,
          second: candidate.value,
        }),
        explanation: ev('safetyViolationExpl'),
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Protocol event handlers
 * ------------------------------------------------------------------ */

function startRound(draft: SimulationState, proposer: ProposerState): void {
  if (proposer.status !== 'active') return;
  // Once this instance has a chosen value there is nothing left to decide.
  if (draft.chosen) return;
  const round = Math.max(1, proposer.round || draft.config.proposalRound);
  const ballot = createBallot(round, proposer.id);
  const updated = beginBallot(proposer, ballot);
  setProposer(draft, updated);

  log(draft, {
    time: draft.virtualTime,
    kind: 'prepare',
    nodeId: proposer.id,
    title: 'Prepare',
    description: ev('prepareSent', {
      proposer: proposer.id,
      ballot: formatBallot(ballot),
      total: draft.acceptors.length,
    }),
    explanation: ev('prepareExpl'),
  });

  for (const acceptor of draft.acceptors) {
    send(draft, 'prepare', proposer.id, acceptor.id, { ballot });
  }
}

function handleStart(draft: SimulationState, proposerId: string): void {
  const proposer = findProposer(draft, proposerId);
  if (!proposer || proposer.status !== 'active') return;
  startRound(draft, proposer);
}

function handleRetry(draft: SimulationState, proposerId: string): void {
  const proposer = findProposer(draft, proposerId);
  if (!proposer || proposer.status !== 'active' || proposer.phase === 'chosen') return;
  startRound(draft, { ...proposer, phase: 'preparing' });
}

function handleRecover(draft: SimulationState, nodeId: string): void {
  const status = nodeStatusOf(draft, nodeId);
  if (status === null || status === 'active') return;
  setNodeStatus(draft, nodeId, 'active');

  if (draft.config.unsafeRecover) {
    const acceptor = findAcceptor(draft, nodeId);
    if (acceptor) {
      setAcceptor(draft, {
        ...acceptor,
        promisedBallot: null,
        acceptedBallot: null,
        acceptedValue: null,
      });
    }
  }

  log(draft, {
    time: draft.virtualTime,
    kind: 'recover',
    nodeId,
    title: `${nodeId} recovered`,
    description: ev(draft.config.unsafeRecover ? 'recoveredUnsafe' : 'recoveredSafe', {
      node: nodeId,
    }),
    explanation: ev(
      draft.config.unsafeRecover ? 'recoveredUnsafeExpl' : 'recoveredSafeExpl',
    ),
  });
}

function applyPrepare(draft: SimulationState, message: Message): void {
  const acceptor = findAcceptor(draft, message.to);
  if (!acceptor) return;
  const now = draft.virtualTime;

  recordReceived(draft, acceptor.id, {
    type: 'prepare',
    peer: message.from,
    ballot: message.ballot,
    value: null,
    at: now,
  });

  const result = onPrepare(acceptor, message.ballot);
  const reply = result.reply;
  setAcceptor(draft, result.acceptor);

  if (reply.kind === 'promise') {
    send(draft, 'promise', acceptor.id, message.from, {
      ballot: reply.ballot,
      acceptedBallot: reply.acceptedBallot,
      acceptedValue: reply.acceptedValue,
    });
    recordSent(draft, acceptor.id, {
      type: 'promise',
      peer: message.from,
      ballot: reply.ballot,
      value: reply.acceptedValue,
      at: now,
    });
    log(draft, {
      time: now,
      kind: 'promise',
      nodeId: acceptor.id,
      packetId: message.id,
      title: 'Promise',
      description:
        reply.acceptedValue !== null
          ? ev('promiseMadeValue', {
              acceptor: acceptor.id,
              ballot: formatBallot(message.ballot),
              value: reply.acceptedValue,
              acceptedBallot: formatBallot(reply.acceptedBallot),
            })
          : ev('promiseMadeNone', {
              acceptor: acceptor.id,
              ballot: formatBallot(message.ballot),
            }),
      explanation: ev(
        reply.acceptedValue !== null ? 'promiseWithValueExpl' : 'promiseNoValueExpl',
      ),
    });
    return;
  }

  if (!isNackReply(reply)) return;
  send(draft, 'nack', acceptor.id, message.from, {
    ballot: reply.ballot,
    reason: reply.reason,
  });
  recordSent(draft, acceptor.id, {
    type: 'nack',
    peer: message.from,
    ballot: reply.ballot,
    value: null,
    at: now,
  });
  log(draft, {
    time: now,
    kind: 'nack',
    nodeId: acceptor.id,
    packetId: message.id,
    title: 'NACK',
    description: ev('nackPrepare', {
      acceptor: acceptor.id,
      ballot: formatBallot(message.ballot),
      reason: { reason: reply.reason },
    }),
    explanation: ev('nackPrepareExpl'),
  });
}

function applyPromise(draft: SimulationState, message: Message): void {
  const proposer = findProposer(draft, message.to);
  if (!proposer) return;
  if (proposer.status !== 'active') return;
  const now = draft.virtualTime;

  if (!proposer.ballot || !equalBallots(proposer.ballot, message.ballot) || proposer.phase !== 'preparing') {
    log(draft, {
      time: now,
      kind: 'system',
      nodeId: proposer.id,
      packetId: message.id,
      title: 'Stale promise ignored',
      description: ev('stalePromise', {
        proposer: proposer.id,
        ballot: formatBallot(message.ballot),
        current: formatBallot(proposer.ballot),
      }),
      explanation: ev('stalePromiseExpl'),
    });
    return;
  }

  const updated = registerPromise(proposer, {
    acceptorId: message.from,
    ballot: message.ballot,
    acceptedBallot: message.acceptedBallot,
    acceptedValue: message.acceptedValue,
    at: now,
  });
  setProposer(draft, updated);
  const count = promiseCount(updated);

  log(draft, {
    time: now,
    kind: 'promise',
    nodeId: proposer.id,
    packetId: message.id,
    title: 'Promise received',
    description: ev('promiseReceived', {
      proposer: proposer.id,
      from: message.from,
      count,
      quorum: draft.quorum,
    }),
    explanation: ev('promiseReceivedExpl'),
  });

  if (!hasPromiseQuorum(updated, draft.quorum) || updated.phase !== 'preparing') return;

  const selection = selectProposalValue(updated);
  const accepting: ProposerState = {
    ...updated,
    phase: 'accepting',
    selectedValue: selection.value,
  };
  setProposer(draft, accepting);
  const currentBallot = accepting.ballot;
  if (!currentBallot) return;

  log(draft, {
    time: now,
    kind: 'quorum',
    nodeId: proposer.id,
    title: 'Quorum',
    description: ev('quorumReached', {
      proposer: proposer.id,
      count,
      quorum: draft.quorum,
    }),
    explanation: ev('quorumReachedExpl'),
  });

  log(draft, {
    time: now,
    kind: 'accept',
    nodeId: proposer.id,
    title: 'Accept',
    description: selection.adoptedFrom
      ? ev('acceptAdopted', {
          proposer: proposer.id,
          ballot: formatBallot(currentBallot),
          value: selection.value,
          adopted: formatBallot(selection.adoptedFrom),
        })
      : ev('acceptOwn', {
          proposer: proposer.id,
          ballot: formatBallot(currentBallot),
          value: selection.value,
        }),
    explanation: ev(selection.adoptedFrom ? 'acceptAdoptedExpl' : 'acceptOwnExpl'),
  });

  for (const acceptor of draft.acceptors) {
    send(draft, 'accept', proposer.id, acceptor.id, {
      ballot: currentBallot,
      value: selection.value,
    });
  }
}

function applyAccept(draft: SimulationState, message: Message): void {
  const acceptor = findAcceptor(draft, message.to);
  if (!acceptor || message.value === null) return;
  const now = draft.virtualTime;

  recordReceived(draft, acceptor.id, {
    type: 'accept',
    peer: message.from,
    ballot: message.ballot,
    value: message.value,
    at: now,
  });

  const result = onAccept(acceptor, message.ballot, message.value);
  const reply = result.reply;
  setAcceptor(draft, result.acceptor);

  if (reply.kind === 'accepted') {
    send(draft, 'accepted', acceptor.id, message.from, {
      ballot: reply.ballot,
      value: reply.value,
    });
    recordSent(draft, acceptor.id, {
      type: 'accepted',
      peer: message.from,
      ballot: reply.ballot,
      value: reply.value,
      at: now,
    });
    for (const learner of draft.learners) {
      send(draft, 'accepted', acceptor.id, learner.id, {
        ballot: reply.ballot,
        value: reply.value,
      });
    }
    log(draft, {
      time: now,
      kind: 'accepted',
      nodeId: acceptor.id,
      packetId: message.id,
      title: 'Accepted',
      description: ev('accepted', {
        acceptor: acceptor.id,
        value: reply.value,
        ballot: formatBallot(reply.ballot),
      }),
      explanation: ev('acceptedExpl'),
    });
    updateChosen(draft);
    return;
  }

  if (!isNackReply(reply)) return;
  send(draft, 'nack', acceptor.id, message.from, {
    ballot: reply.ballot,
    reason: reply.reason,
  });
  recordSent(draft, acceptor.id, {
    type: 'nack',
    peer: message.from,
    ballot: reply.ballot,
    value: null,
    at: now,
  });
  log(draft, {
    time: now,
    kind: 'nack',
    nodeId: acceptor.id,
    packetId: message.id,
    title: 'NACK',
    description: ev('nackAccept', {
      acceptor: acceptor.id,
      ballot: formatBallot(message.ballot),
      reason: { reason: reply.reason },
    }),
    explanation: ev('nackAcceptExpl'),
  });
}

function applyAccepted(draft: SimulationState, message: Message): void {
  const now = draft.virtualTime;
  const proposer = findProposer(draft, message.to);
  if (proposer) {
    if (!proposer.ballot || !equalBallots(proposer.ballot, message.ballot)) {
      log(draft, {
        time: now,
        kind: 'system',
        nodeId: proposer.id,
        packetId: message.id,
        title: 'Stale Accepted ignored',
        description: ev('staleAccepted', {
          proposer: proposer.id,
          ballot: formatBallot(message.ballot),
        }),
        explanation: ev('staleAcceptedExpl'),
      });
      return;
    }
    if (message.value === null) return;
    const updated = registerAccepted(proposer, {
      acceptorId: message.from,
      ballot: message.ballot,
      value: message.value,
      at: now,
    });
    setProposer(draft, updated);
    log(draft, {
      time: now,
      kind: 'accepted',
      nodeId: proposer.id,
      packetId: message.id,
      title: 'Accepted received',
      description: ev('acceptedReceived', {
        proposer: proposer.id,
        from: message.from,
        count: updated.accepts.length,
        quorum: draft.quorum,
      }),
      explanation: ev('acceptedReceivedExpl'),
    });
    return;
  }

  const learner = findLearner(draft, message.to);
  if (!learner || message.value === null) return;
  const updated = recordAccepted(
    learner,
    { from: message.from, ballot: message.ballot, value: message.value, at: now },
    draft.quorum,
  );
  setLearner(draft, updated);
  log(draft, {
    time: now,
    kind: 'accepted',
    nodeId: learner.id,
    packetId: message.id,
    title: updated.chosenValue ? 'Value learned' : 'Accepted received',
    description: updated.chosenValue
      ? ev('learnerLearned', { learner: learner.id, value: updated.chosenValue })
      : ev('learnerRecorded', {
          learner: learner.id,
          from: message.from,
          value: message.value,
        }),
    explanation: ev(updated.chosenValue ? 'learnerLearnedExpl' : 'learnerRecordedExpl'),
  });
}

function applyNack(draft: SimulationState, message: Message): void {
  const proposer = findProposer(draft, message.to);
  if (!proposer || proposer.status !== 'active') return;
  if (!proposer.ballot || !equalBallots(proposer.ballot, message.ballot)) return;
  const now = draft.virtualTime;

  const reason: ReasonInfo = message.reason ?? { code: 'rejected' };
  const updated = registerNack(proposer, {
    acceptorId: message.from,
    ballot: message.ballot,
    reason,
    at: now,
  });
  setProposer(draft, updated);
  log(draft, {
    time: now,
    kind: 'nack',
    nodeId: proposer.id,
    packetId: message.id,
    title: 'NACK received',
    description: ev('nackReceived', {
      proposer: proposer.id,
      from: message.from,
      reason: { reason },
    }),
    explanation: ev('nackReceivedExpl'),
  });

  if (!draft.config.autoRetry || updated.phase === 'chosen') return;

  const pendingRetry = draft.queue.some(
    (event) => event.kind === 'retry' && event.proposerId === proposer.id,
  );
  if (pendingRetry) return;

  const highest = highestNackedBallot(updated);
  const nextRoundValue = Math.max(updated.round + 1, highest ? highest.round + 1 : 1);
  setProposer(draft, { ...updated, round: nextRoundValue, phase: 'retrying', retries: updated.retries + 1 });
  enqueue(draft, {
    time: now + draft.config.retryDelay,
    kind: 'retry',
    proposerId: proposer.id,
  });
  log(draft, {
    time: now,
    kind: 'retry',
    nodeId: proposer.id,
    title: 'Retry scheduled',
    description: ev('retryScheduled', {
      proposer: proposer.id,
      round: nextRoundValue,
      delay: draft.config.retryDelay,
    }),
    explanation: ev('retryScheduledExpl'),
  });
}

function deliver(draft: SimulationState, message: Message): void {
  if (message.status !== 'inflight') return;
  const status = nodeStatusOf(draft, message.to);
  if (status === null) {
    dropDelivered(draft, message, { code: 'unknownDestination' });
    return;
  }
  if (status !== 'active') {
    dropDelivered(draft, message, { code: 'nodeNotActive', node: message.to, status });
    return;
  }

  message.status = 'delivered';
  draft.stats.delivered += 1;

  switch (message.type) {
    case 'prepare':
      applyPrepare(draft, message);
      break;
    case 'promise':
      applyPromise(draft, message);
      break;
    case 'accept':
      applyAccept(draft, message);
      break;
    case 'accepted':
      applyAccepted(draft, message);
      break;
    case 'nack':
      applyNack(draft, message);
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Public simulation API
 * ------------------------------------------------------------------ */

/** Process exactly one event from the deterministic queue. */
export function processNextEvent(state: SimulationState): SimulationState {
  const popped = popEvent(state.queue);
  if (!popped) return state;

  const draft = cloneState(state);
  draft.queue = popped.queue;
  draft.virtualTime = Math.max(draft.virtualTime, popped.event.time);
  draft.stats.events += 1;

  switch (popped.event.kind) {
    case 'start':
      if (popped.event.proposerId) handleStart(draft, popped.event.proposerId);
      break;
    case 'retry':
      if (popped.event.proposerId) handleRetry(draft, popped.event.proposerId);
      break;
    case 'recover':
      if (popped.event.nodeId) handleRecover(draft, popped.event.nodeId);
      break;
    case 'deliver': {
      const message = popped.event.messageId
        ? draft.messages.find((entry) => entry.id === popped.event.messageId)
        : undefined;
      if (message) deliver(draft, message);
      break;
    }
  }

  return draft;
}

export function runToCompletion(
  state: SimulationState,
  maxEvents = 2000,
): SimulationState {
  let current = state;
  let processed = 0;
  while (peekEvent(current.queue) && processed < maxEvents) {
    current = processNextEvent(current);
    processed += 1;
  }
  return current;
}

export function crashNode(state: SimulationState, nodeId: string): SimulationState {
  const status = nodeStatusOf(state, nodeId);
  if (status === null || status === 'crashed') return state;
  const draft = cloneState(state);
  setNodeStatus(draft, nodeId, 'crashed');
  log(draft, {
    time: draft.virtualTime,
    kind: 'crash',
    nodeId,
    title: `${nodeId} crashed`,
    description: ev('crashed', { node: nodeId }),
    explanation: ev('crashedExpl'),
  });
  return draft;
}

export function recoverNode(state: SimulationState, nodeId: string): SimulationState {
  const status = nodeStatusOf(state, nodeId);
  if (status === null || status === 'active' || status === 'recovering') return state;
  const draft = cloneState(state);
  setNodeStatus(draft, nodeId, 'recovering');
  enqueue(draft, {
    time: draft.virtualTime + draft.config.recoveryDelay,
    kind: 'recover',
    nodeId,
  });
  log(draft, {
    time: draft.virtualTime,
    kind: 'recover',
    nodeId,
    title: `${nodeId} recovering`,
    description: ev('recovering', { node: nodeId, delay: draft.config.recoveryDelay }),
    explanation: ev('recoveringExpl'),
  });
  return draft;
}

function dropMatchingPackets(
  draft: SimulationState,
  predicate: (message: Message) => boolean,
  reason: ReasonInfo,
): number {
  const ids = new Set<string>();
  for (const message of draft.messages) {
    if (message.status === 'inflight' && predicate(message)) {
      message.status = 'dropped';
      message.dropAt = draft.virtualTime + 40;
      message.dropReason = reason;
      draft.stats.dropped += 1;
      ids.add(message.id);
    }
  }
  if (ids.size > 0) {
    draft.queue = draft.queue.filter(
      (event) => !(event.kind === 'deliver' && event.messageId && ids.has(event.messageId)),
    );
  }
  return ids.size;
}

export function toggleLinkFailure(
  state: SimulationState,
  a: string,
  b: string,
): SimulationState {
  const draft = cloneState(state);
  const key = `${a}->${b}`;
  const reverse = `${b}->${a}`;
  const disabled = draft.disabledLinks.includes(key) || draft.disabledLinks.includes(reverse);

  if (disabled) {
    draft.disabledLinks = draft.disabledLinks.filter((entry) => entry !== key && entry !== reverse);
    log(draft, {
      time: draft.virtualTime,
      kind: 'link',
      nodeId: a,
      title: 'Link restored',
      description: ev('linkRestored', { a, b }),
      explanation: ev('linkRestoredExpl'),
    });
  } else {
    draft.disabledLinks = [...draft.disabledLinks, key, reverse];
    const dropped = dropMatchingPackets(
      draft,
      (message) =>
        (message.from === a && message.to === b) || (message.from === b && message.to === a),
      LINK_DISABLED,
    );
    log(draft, {
      time: draft.virtualTime,
      kind: 'link',
      nodeId: a,
      title: 'Link disabled',
      description: dropped
        ? ev('linkDisabledLost', { a, b, count: dropped })
        : ev('linkDisabled', { a, b }),
      explanation: ev('linkDisabledExpl'),
    });
  }
  return draft;
}

export function togglePartition(state: SimulationState): SimulationState {
  const draft = cloneState(state);
  draft.partitionEnabled = !draft.partitionEnabled;

  if (draft.partitionEnabled) {
    const dropped = dropMatchingPackets(
      draft,
      (message) =>
        draft.partitionGroupA.includes(message.from) !==
        draft.partitionGroupA.includes(message.to),
      PARTITIONED,
    );
    log(draft, {
      time: draft.virtualTime,
      kind: 'partition',
      title: 'Network partition',
      description: dropped
        ? ev('partitionOnLost', { group: draft.partitionGroupA.join(', '), count: dropped })
        : ev('partitionOn', { group: draft.partitionGroupA.join(', ') }),
      explanation: ev('partitionOnExpl'),
    });
  } else {
    log(draft, {
      time: draft.virtualTime,
      kind: 'partition',
      title: 'Partition healed',
      description: ev('partitionHealed'),
      explanation: ev('partitionHealedExpl'),
    });
  }
  return draft;
}

export function dropInflightPackets(state: SimulationState): SimulationState {
  const draft = cloneState(state);
  const dropped = dropMatchingPackets(draft, () => true, { code: 'manualDrop' });
  log(draft, {
    time: draft.virtualTime,
    kind: 'drop',
    title: 'Packets dropped',
    description: ev('packetsDropped', { count: dropped }),
    explanation: ev('packetsDroppedExpl'),
  });
  return draft;
}

export function retryProposal(state: SimulationState, proposerId: string): SimulationState {
  const proposer = findProposer(state, proposerId);
  if (!proposer || proposer.status !== 'active') return state;
  const draft = cloneState(state);
  const nextRoundValue = Math.max(proposer.round + 1, draft.config.proposalRound + 1);
  setProposer(draft, { ...proposer, round: nextRoundValue, phase: 'retrying', retries: proposer.retries + 1 });
  enqueue(draft, { time: draft.virtualTime, kind: 'retry', proposerId });
  log(draft, {
    time: draft.virtualTime,
    kind: 'retry',
    nodeId: proposer.id,
    title: 'Manual retry',
    description: ev('manualRetry', { proposer: proposer.id, round: nextRoundValue }),
    explanation: ev('manualRetryExpl'),
  });
  return draft;
}

export type ProtocolStatusKey =
  | 'ready'
  | 'chosen'
  | 'stalled'
  | 'phase1'
  | 'phase2'
  | 'inProgress'
  | 'safety';

export function describeProtocol(state: SimulationState): {
  key: ProtocolStatusKey;
  value?: string;
  tone: 'idle' | 'active' | 'success' | 'error';
} {
  if (state.safetyViolation) return { key: 'safety', tone: 'error' };
  if (state.chosen) return { key: 'chosen', value: state.chosen.value, tone: 'success' };

  const phase = state.proposers.find(
    (proposer) => proposer.phase === 'preparing' || proposer.phase === 'accepting',
  )?.phase;
  if (state.queue.length === 0) return { key: 'stalled', tone: 'error' };
  if (phase === 'accepting') return { key: 'phase2', tone: 'active' };
  if (phase === 'preparing') return { key: 'phase1', tone: 'active' };
  if (state.stats.events === 0) return { key: 'ready', tone: 'idle' };
  return { key: 'inProgress', tone: 'active' };
}
