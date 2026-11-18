import { linkBlockReason, planTransmission } from '../network/network-engine';
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
    description: string;
    explanation: string;
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
  reason?: string | null;
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
      title: plan.reason === 'packet loss' ? 'Packet lost' : 'Packet blocked',
      description: `${from} → ${to} ${type} (${formatBallot(payload.ballot)}) — ${plan.reason}`,
      explanation:
        plan.reason === 'packet loss'
          ? 'The network dropped this packet randomly. Paxos tolerates lost packets: the proposer simply never counts this acceptor and may retry with a higher ballot.'
          : plan.reason === 'network partition'
            ? 'The two endpoints are on opposite sides of the simulated partition, so the message cannot cross. Quorum intersection is what stops a minority side from choosing a value.'
            : 'This communication link was disabled by the user, so the packet never reaches its destination. The protocol treats it exactly like a lost message.',
    });
  } else {
    enqueue(draft, { time: plan.arriveAt, kind: 'deliver', messageId: message.id });
  }

  return message;
}

function dropDelivered(draft: SimulationState, message: Message, reason: string): void {
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
    description: `${message.type} from ${message.from} could not be delivered to ${message.to} — ${reason}`,
    explanation:
      'A crashed or isolated node cannot receive messages. Its durable Paxos state stays on disk, but while it is down it takes no part in quorums.',
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
        description: `${candidate.count} of ${draft.acceptors.length} acceptors accepted "${candidate.value}" at ballot ${formatBallot(candidate.ballot)} — quorum is ${draft.quorum}.`,
        explanation:
          'A value is chosen only when a majority of acceptors have durably accepted the same (ballot, value). Any future proposal must reuse this value, because its promise quorum must intersect this accepting quorum.',
      });
    } else if (draft.chosen.value !== candidate.value) {
      draft.safetyViolation = `Two different values chosen: "${draft.chosen.value}" and "${candidate.value}"`;
      log(draft, {
        time: draft.virtualTime,
        kind: 'system',
        title: 'Safety violation',
        description: draft.safetyViolation,
        explanation: 'This must never happen in Basic Paxos. It indicates a bug in the protocol engine.',
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
    description: `${proposer.id} sends Prepare(${formatBallot(ballot)}) to ${draft.acceptors.length} acceptor(s).`,
    explanation:
      'Phase 1. The proposer asks every acceptor to promise not to accept anything older than this ballot. The promise responses also reveal any value an acceptor has already accepted.',
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
    description: draft.config.unsafeRecover
      ? `${nodeId} is back online with its durable Paxos state ERASED (unsafe experiment).`
      : `${nodeId} is back online; its promised and accepted state was preserved.`,
    explanation: draft.config.unsafeRecover
      ? 'This intentionally unsafe mode forgets promises and accepted values. It can let two different values become chosen, which is exactly why Paxos requires durable state.'
      : 'Acceptor promises and accepted values are durable. A restarted acceptor must remember them, or safety can be violated.',
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
        `${acceptor.id} promises ${formatBallot(message.ballot)}` +
        (reply.acceptedValue !== null
          ? ` and reports accepted "${reply.acceptedValue}" at ${formatBallot(reply.acceptedBallot)}.`
          : ' and reports no previously accepted value.'),
      explanation:
        reply.acceptedValue !== null
          ? 'The promise carries the acceptor’s previously accepted proposal. The proposer must adopt the value of the highest such ballot, which protects an already chosen value.'
          : 'This acceptor had accepted nothing yet, so the proposer is free to propose its own value — provided a quorum promises.',
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
    description: `${acceptor.id} rejects Prepare(${formatBallot(message.ballot)}): ${reply.reason}.`,
    explanation:
      'The ballot is lower than a promise the acceptor already made. The proposer must advance to a higher round; this is how a competing proposer preempts an older attempt.',
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
      description: `${proposer.id} ignores a Promise for ${formatBallot(message.ballot)} (current ballot ${formatBallot(proposer.ballot)}).`,
      explanation:
        'The proposer already moved to another round, so this response belongs to an abandoned attempt and must not be counted.',
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
    description: `${proposer.id} receives Promise from ${message.from} — ${count}/${draft.quorum} promises.`,
    explanation:
      'Each promise is one vote for phase 1. The proposer may only start phase 2 after a strict majority promises, and it must adopt the highest previously accepted value it was told about.',
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
    description: `${proposer.id} has ${count} of the ${draft.quorum} promises it needs.`,
    explanation:
      'A promise quorum means no older ballot can still reach an accepting quorum. That is what makes phase 2 safe to start.',
  });

  log(draft, {
    time: now,
    kind: 'accept',
    nodeId: proposer.id,
    title: 'Accept',
    description:
      `${proposer.id} sends Accept(${formatBallot(currentBallot)}, "${selection.value}")` +
      (selection.adoptedFrom
        ? ` — adopting the value already accepted at ${formatBallot(selection.adoptedFrom)}.`
        : ' — using its own value, because no acceptor reported a previous acceptance.'),
    explanation: selection.adoptedFrom
      ? 'The proposer is not free to choose here. It adopted the value of the highest accepted ballot reported in the promises, which is how a possibly chosen value survives.'
      : 'No promise carried an accepted value, so this proposal cannot conflict with a value that is already chosen.',
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
      description: `${acceptor.id} accepts "${reply.value}" at ballot ${formatBallot(reply.ballot)}.`,
      explanation:
        'The acceptor had promised nothing higher, so it durably records the accepted ballot and value. It reports this to the proposer and to all learners.',
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
    description: `${acceptor.id} rejects Accept(${formatBallot(message.ballot)}): ${reply.reason}.`,
    explanation:
      'A higher ballot was promised in the meantime, so this acceptor refuses the older proposal. The proposer must retry with a higher ballot.',
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
        description: `${proposer.id} ignores an Accepted for ${formatBallot(message.ballot)}.`,
        explanation: 'The proposer has already moved on to a different ballot.',
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
      description: `${proposer.id} receives Accepted from ${message.from} — ${updated.accepts.length}/${draft.quorum}.`,
      explanation:
        'The proposer counts confirmations, but consensus is not declared by the proposer: it is determined by the acceptors’ durable state.',
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
      ? `${learner.id} learns the chosen value "${updated.chosenValue}".`
      : `${learner.id} records Accepted from ${message.from} for "${message.value}".`,
    explanation: updated.chosenValue
      ? 'The learner saw a quorum of acceptors report the same (ballot, value), so it can safely act on the value.'
      : 'Learners are passive. They only conclude once a quorum of acceptors reports the same proposal.',
  });
}

function applyNack(draft: SimulationState, message: Message): void {
  const proposer = findProposer(draft, message.to);
  if (!proposer || proposer.status !== 'active') return;
  if (!proposer.ballot || !equalBallots(proposer.ballot, message.ballot)) return;
  const now = draft.virtualTime;

  const updated = registerNack(proposer, {
    acceptorId: message.from,
    ballot: message.ballot,
    reason: message.reason ?? 'rejected',
    at: now,
  });
  setProposer(draft, updated);
  log(draft, {
    time: now,
    kind: 'nack',
    nodeId: proposer.id,
    packetId: message.id,
    title: 'NACK received',
    description: `${proposer.id} is rejected by ${message.from}: ${message.reason ?? 'rejected'}.`,
    explanation:
      'A competing proposer holds a higher promise. Safety is untouched, but progress is blocked until this proposer retries with a higher ballot.',
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
    description: `${proposer.id} will retry with round ${nextRoundValue} in ${draft.config.retryDelay} ms.`,
    explanation:
      'The proposer advances past the highest ballot it saw. Retrying with a higher ballot can preempt the competing proposal while preserving any value already accepted.',
  });
}

function deliver(draft: SimulationState, message: Message): void {
  if (message.status !== 'inflight') return;
  const status = nodeStatusOf(draft, message.to);
  if (status === null) {
    dropDelivered(draft, message, 'unknown destination');
    return;
  }
  if (status !== 'active') {
    dropDelivered(draft, message, `${message.to} is ${status}`);
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
    description: `${nodeId} is down. Its durable Paxos state is preserved on disk.`,
    explanation:
      'A crashed acceptor stops answering, so it no longer counts toward any quorum. Messages sent to it are dropped on arrival.',
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
    description: `${nodeId} is restarting and will be active again in ${draft.config.recoveryDelay} ms.`,
    explanation:
      'While recovering the node still cannot participate. On restart it restores its promised and accepted state from durable storage.',
  });
  return draft;
}

function dropMatchingPackets(
  draft: SimulationState,
  predicate: (message: Message) => boolean,
  reason: string,
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
      description: `Communication between ${a} and ${b} works again.`,
      explanation: 'New packets may cross this link. Packets that were already dropped stay lost.',
    });
  } else {
    draft.disabledLinks = [...draft.disabledLinks, key, reverse];
    const dropped = dropMatchingPackets(
      draft,
      (message) =>
        (message.from === a && message.to === b) || (message.from === b && message.to === a),
      'link disabled',
    );
    log(draft, {
      time: draft.virtualTime,
      kind: 'link',
      nodeId: a,
      title: 'Link disabled',
      description: `Communication between ${a} and ${b} is blocked${dropped ? `; ${dropped} in-flight packet(s) lost` : ''}.`,
      explanation:
        'A failed link silently loses messages. Paxos cannot tell a lost link from a slow node, so it simply waits or retries.',
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
      'network partition',
    );
    log(draft, {
      time: draft.virtualTime,
      kind: 'partition',
      title: 'Network partition',
      description: `Partition active: [${draft.partitionGroupA.join(', ')}] are isolated from the rest${dropped ? `; ${dropped} in-flight packet(s) lost` : ''}.`,
      explanation:
        'Each side can still talk internally, but not across the split. Only a side holding a majority of acceptors can make progress — this is how Paxos stays safe under partition.',
    });
  } else {
    log(draft, {
      time: draft.virtualTime,
      kind: 'partition',
      title: 'Partition healed',
      description: 'All nodes can communicate again.',
      explanation:
        'Once the split heals, a proposer that retries with a higher ballot will collect promises and can finish the protocol.',
    });
  }
  return draft;
}

export function dropInflightPackets(state: SimulationState): SimulationState {
  const draft = cloneState(state);
  const dropped = dropMatchingPackets(draft, () => true, 'manually dropped');
  log(draft, {
    time: draft.virtualTime,
    kind: 'drop',
    title: 'Packets dropped',
    description: `${dropped} in-flight packet(s) were dropped by the user.`,
    explanation:
      'Simulating packet loss by hand shows how the protocol copes: missing promises simply reduce the response count, and missing accepts prevent that acceptor from contributing to the quorum.',
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
    description: `${proposer.id} retries with round ${nextRoundValue}.`,
    explanation:
      'A higher ballot can break a deadlock between competing proposers. The new promises still force the proposer to adopt any value that was already accepted.',
  });
  return draft;
}

export function describeProtocol(state: SimulationState): {
  label: string;
  tone: 'idle' | 'active' | 'success' | 'error';
} {
  if (state.safetyViolation) return { label: 'Safety violation', tone: 'error' };
  if (state.chosen) return { label: `Chosen: ${state.chosen.value}`, tone: 'success' };

  const phase = state.proposers.find(
    (proposer) => proposer.phase === 'preparing' || proposer.phase === 'accepting',
  )?.phase;
  if (state.queue.length === 0) return { label: 'Stalled — no quorum', tone: 'error' };
  if (phase === 'accepting') return { label: 'Phase 2 · Accept', tone: 'active' };
  if (phase === 'preparing') return { label: 'Phase 1 · Prepare', tone: 'active' };
  if (state.stats.events === 0) return { label: 'Ready', tone: 'idle' };
  return { label: 'In progress', tone: 'active' };
}
