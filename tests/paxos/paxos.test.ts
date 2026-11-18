import { describe, expect, it } from 'vitest';
import { onAccept, onPrepare } from '../../src/core/paxos/acceptor';
import { compareBallots, createBallot, equalBallots, formatBallot } from '../../src/core/paxos/ballot';
import { detectChosen, findQuorumValues } from '../../src/core/paxos/protocol-engine';
import { promiseCount, registerPromise, selectProposalValue } from '../../src/core/paxos/proposer';
import { quorumSize } from '../../src/core/paxos/quorum';
import type { AcceptorState, ProposerState } from '../../src/core/paxos/types';
import {
  crashNode,
  processNextEvent,
  recoverNode,
  retryProposal,
  runToCompletion,
} from '../../src/core/simulation/simulation-engine';
import { advanceUntil, createSim, runSim } from '../helpers';

function acceptor(id: string, patch: Partial<AcceptorState> = {}): AcceptorState {
  return {
    id,
    role: 'acceptor',
    status: 'active',
    promisedBallot: null,
    acceptedBallot: null,
    acceptedValue: null,
    received: [],
    sent: [],
    ...patch,
  };
}

function proposer(patch: Partial<ProposerState> = {}): ProposerState {
  return {
    id: 'P1',
    role: 'proposer',
    status: 'active',
    proposedValue: 'alpha',
    round: 1,
    ballot: null,
    phase: 'idle',
    promises: [],
    nacks: [],
    accepts: [],
    selectedValue: null,
    chosenValue: null,
    retries: 0,
    ...patch,
  };
}

describe('quorum calculation', () => {
  it('is a strict majority for every supported cluster size', () => {
    expect(quorumSize(3)).toBe(2);
    expect(quorumSize(5)).toBe(3);
    expect(quorumSize(7)).toBe(4);
    expect(quorumSize(9)).toBe(5);
  });

  it('any two quorums intersect', () => {
    for (const size of [3, 5, 7, 9]) {
      expect(2 * quorumSize(size)).toBeGreaterThan(size);
    }
  });
});

describe('ballot ordering', () => {
  it('orders by round first, then proposer id', () => {
    expect(compareBallots(createBallot(2, 'P1'), createBallot(1, 'P9'))).toBeGreaterThan(0);
    expect(compareBallots(createBallot(1, 'P1'), createBallot(1, 'P2'))).toBeLessThan(0);
    expect(compareBallots(createBallot(3, 'P2'), createBallot(3, 'P2'))).toBe(0);
    expect(equalBallots(createBallot(3, 'P2'), createBallot(3, 'P2'))).toBe(true);
    expect(formatBallot(createBallot(4, 'P2'))).toBe('4.P2');
  });
});

describe('acceptor semantics', () => {
  it('promises a ballot greater than or equal to the current promise', () => {
    const initial = acceptor('A1', { promisedBallot: createBallot(2, 'P1') });
    const result = onPrepare(initial, createBallot(2, 'P1'));
    expect(result.reply.kind).toBe('promise');
    expect(result.acceptor.promisedBallot).toEqual(createBallot(2, 'P1'));
  });

  it('rejects a lower prepare with a NACK', () => {
    const initial = acceptor('A1', { promisedBallot: createBallot(3, 'P1') });
    const result = onPrepare(initial, createBallot(1, 'P2'));
    expect(result.reply.kind).toBe('nack');
    expect(result.acceptor.promisedBallot).toEqual(createBallot(3, 'P1'));
  });

  it('never accepts a ballot lower than its promise', () => {
    const initial = acceptor('A1', { promisedBallot: createBallot(5, 'P1') });
    const result = onAccept(initial, createBallot(4, 'P2'), 'beta');
    expect(result.reply.kind).toBe('nack');
    expect(result.acceptor.acceptedBallot).toBeNull();
    expect(result.acceptor.acceptedValue).toBeNull();
  });

  it('returns its previously accepted proposal inside a promise', () => {
    const initial = acceptor('A1', {
      acceptedBallot: createBallot(1, 'P1'),
      acceptedValue: 'alpha',
    });
    const result = onPrepare(initial, createBallot(2, 'P2'));
    expect(result.reply).toMatchObject({
      kind: 'promise',
      acceptedBallot: createBallot(1, 'P1'),
      acceptedValue: 'alpha',
    });
  });

  it('stores the accepted value and raises the promise', () => {
    const result = onAccept(acceptor('A1'), createBallot(2, 'P2'), 'gamma');
    expect(result.reply).toMatchObject({ kind: 'accepted', value: 'gamma' });
    expect(result.acceptor.acceptedValue).toBe('gamma');
    expect(result.acceptor.promisedBallot).toEqual(createBallot(2, 'P2'));
  });
});

describe('proposer value selection', () => {
  const ballotOne = createBallot(1, 'P1');
  const ballotTwo = createBallot(1, 'P2');

  it('adopts the value of the highest accepted ballot', () => {
    let state = proposer({ ballot: createBallot(3, 'P1'), phase: 'preparing' });
    state = registerPromise(state, {
      acceptorId: 'A1',
      ballot: createBallot(3, 'P1'),
      acceptedBallot: ballotOne,
      acceptedValue: 'alpha',
      at: 0,
    });
    state = registerPromise(state, {
      acceptorId: 'A2',
      ballot: createBallot(3, 'P1'),
      acceptedBallot: ballotTwo,
      acceptedValue: 'gamma',
      at: 0,
    });
    expect(promiseCount(state)).toBe(2);
    expect(selectProposalValue(state)).toMatchObject({ value: 'gamma', adoptedFrom: ballotTwo });
  });

  it('uses its own value when no promise carries an accepted proposal', () => {
    let state = proposer({ ballot: createBallot(1, 'P1'), phase: 'preparing' });
    state = registerPromise(state, {
      acceptorId: 'A1',
      ballot: createBallot(1, 'P1'),
      acceptedBallot: null,
      acceptedValue: null,
      at: 0,
    });
    expect(selectProposalValue(state)).toEqual({ value: 'alpha', adoptedFrom: null });
  });

  it('ignores promises for a different ballot', () => {
    const state = registerPromise(
      proposer({ ballot: createBallot(2, 'P1'), phase: 'preparing' }),
      {
        acceptorId: 'A1',
        ballot: createBallot(1, 'P1'),
        acceptedBallot: null,
        acceptedValue: null,
        at: 0,
      },
    );
    expect(state.promises).toHaveLength(0);
  });
});

describe('chosen detection', () => {
  it('requires a quorum of acceptors with the same ballot and value', () => {
    const half = [
      acceptor('A1', { acceptedBallot: createBallot(1, 'P1'), acceptedValue: 'alpha' }),
      acceptor('A2', { acceptedBallot: createBallot(1, 'P1'), acceptedValue: 'alpha' }),
      acceptor('A3'),
    ];
    expect(findQuorumValues(half, 2)).toHaveLength(1);
    expect(detectChosen(half, 2)?.value).toBe('alpha');
    expect(detectChosen(half.slice(0, 1), 2)).toBeNull();
  });

  it('does not treat matching values from different ballots as one proposal', () => {
    const acceptors = [
      acceptor('A1', { acceptedBallot: createBallot(1, 'P1'), acceptedValue: 'alpha' }),
      acceptor('A2', { acceptedBallot: createBallot(2, 'P2'), acceptedValue: 'alpha' }),
      acceptor('A3'),
    ];
    expect(findQuorumValues(acceptors, 2)).toHaveLength(0);
  });
});

describe('end-to-end Basic Paxos', () => {
  it('reaches consensus with three acceptors', () => {
    const state = runSim({ acceptorCount: 3, learnerCount: 1 });
    expect(state.chosen?.value).toBe('alpha');
    expect(state.chosen?.ballot).toEqual(createBallot(1, 'P1'));
    expect(state.safetyViolation).toBeNull();
    expect(state.acceptors.filter((entry) => entry.acceptedValue === 'alpha')).toHaveLength(3);
    const learner = state.learners[0];
    expect(learner.chosenValue).toBe('alpha');
  });

  it('reaches consensus with five acceptors', () => {
    const state = runSim({ acceptorCount: 5, learnerCount: 2 });
    expect(state.chosen?.value).toBe('alpha');
    expect(state.acceptors.filter((entry) => entry.acceptedValue === 'alpha').length).toBeGreaterThanOrEqual(3);
    expect(state.learners.every((learner) => learner.chosenValue === 'alpha')).toBe(true);
  });

  it('reaches consensus with seven acceptors and zero loss', () => {
    const state = runSim({ acceptorCount: 7 });
    expect(state.chosen?.value).toBe('alpha');
    expect(state.quorum).toBe(4);
  });

  it('keeps working when one acceptor is crashed before Prepare', () => {
    const state = runToCompletion(crashNode(createSim({ acceptorCount: 3 }), 'A3'));
    expect(state.chosen?.value).toBe('alpha');
    expect(state.acceptors.find((entry) => entry.id === 'A3')?.acceptedValue).toBeNull();
  });

  it('does not choose a value without a quorum', () => {
    let state = crashNode(createSim({ acceptorCount: 3 }), 'A2');
    state = crashNode(state, 'A3');
    state = runToCompletion(state);
    expect(state.chosen).toBeNull();
    expect(state.learners[0].chosenValue).toBeNull();
    expect(state.stats.dropped).toBeGreaterThan(0);
  });

  it('preserves durable acceptor state across a crash and recovery', () => {
    let state = runSim({ acceptorCount: 3 });
    const promisedBefore = state.acceptors[0].promisedBallot;
    const acceptedBefore = state.acceptors[0].acceptedBallot;

    state = crashNode(state, 'A1');
    expect(state.acceptors[0].promisedBallot).toEqual(promisedBefore);
    expect(state.acceptors[0].acceptedBallot).toEqual(acceptedBefore);

    state = recoverNode(state, 'A1');
    expect(state.acceptors[0].status).toBe('recovering');
    state = runToCompletion(state);
    expect(state.acceptors[0].status).toBe('active');
    expect(state.acceptors[0].promisedBallot).toEqual(promisedBefore);
    expect(state.acceptors[0].acceptedBallot).toEqual(acceptedBefore);
  });

  it('preserves a previously accepted value when a new proposer takes over', () => {
    let state = createSim({ acceptorCount: 3 });

    // Advance to the point where P1 has sent Accept.
    state = advanceUntil(state, (current) => current.log.some((entry) => entry.kind === 'accept'));
    const acceptTime = state.virtualTime;
    expect(state.log.some((entry) => entry.kind === 'accept')).toBe(true);

    // Crash two acceptors so only A1 can accept and no quorum is possible.
    state = crashNode(state, 'A2');
    state = crashNode(state, 'A3');
    state = runToCompletion(state);
    expect(state.chosen).toBeNull();
    expect(state.acceptors[0].acceptedValue).toBe('alpha');
    expect(state.virtualTime).toBeGreaterThanOrEqual(acceptTime);

    // Bring them back, then let the same proposer try again with a different
    // value and a higher ballot. It must adopt the accepted value instead.
    state = recoverNode(state, 'A2');
    state = recoverNode(state, 'A3');
    state = runToCompletion(state);
    state = {
      ...state,
      proposers: state.proposers.map((entry) => ({ ...entry, proposedValue: 'beta' })),
    };
    state = retryProposal(state, 'P1');
    state = runToCompletion(state);

    expect(state.proposers[0].selectedValue).toBe('alpha');
    expect(state.chosen?.value).toBe('alpha');
  });

  it('lets competing proposers converge on a single value', () => {
    const state = runSim({ proposerCount: 2, acceptorCount: 3, startStagger: 220 });
    expect(state.chosen).not.toBeNull();
    expect(state.safetyViolation).toBeNull();
    expect(state.log.some((entry) => entry.kind === 'nack')).toBe(true);

    const chosenValues = new Set(
      state.log.filter((entry) => entry.kind === 'chosen').map((entry) => entry.description),
    );
    expect(chosenValues.size).toBe(1);
  });

  it('preempts a lower ballot with a higher one', () => {
    const lower = createBallot(1, 'P1');
    const higher = createBallot(2, 'P2');
    const acceptorState = acceptor('A1', { promisedBallot: lower });
    const prepareResult = onPrepare(acceptorState, higher);
    expect(prepareResult.reply.kind).toBe('promise');
    const acceptResult = onAccept(prepareResult.acceptor, higher, 'beta');
    expect(acceptResult.reply.kind).toBe('accepted');
  });

  it('retries with a higher ballot after a NACK', () => {
    let state = advanceUntil(
      runSim({ proposerCount: 2, acceptorCount: 3 }),
      (current) => current.log.some((entry) => entry.kind === 'retry'),
    );
    const retry = state.log.find((entry) => entry.kind === 'retry');
    expect(retry).toBeDefined();
    state = runToCompletion(state);
    expect(state.chosen).not.toBeNull();
  });
});

describe('safety properties', () => {
  it('never chooses two different values and never breaks acceptor invariants', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = runSim({
        seed,
        acceptorCount: 5,
        proposerCount: 2,
        learnerCount: 2,
        packetLoss: 0.15,
      });

      expect(state.safetyViolation).toBeNull();

      for (const entry of state.acceptors) {
        if (entry.promisedBallot && entry.acceptedBallot) {
          expect(compareBallots(entry.acceptedBallot, entry.promisedBallot)).toBeLessThanOrEqual(0);
        }
      }

      const chosenEntries = state.log.filter((entry) => entry.kind === 'chosen');
      const values = new Set(
        chosenEntries.map((entry) => entry.description.match(/"([^"]+)"/)?.[1] ?? entry.id),
      );
      expect(values.size).toBeLessThanOrEqual(1);
    }
  });

  it('reproduces the same run from the same seed', () => {
    const first = runSim({ seed: 7, packetLoss: 0.2, proposerCount: 2 });
    const second = runSim({ seed: 7, packetLoss: 0.2, proposerCount: 2 });
    expect(first.log.map((entry) => `${entry.time}:${entry.title}`)).toEqual(
      second.log.map((entry) => `${entry.time}:${entry.title}`),
    );
    expect(first.chosen).toEqual(second.chosen);
  });

  it('keeps a chosen value stable once consensus is reached', () => {
    let state = runSim({ acceptorCount: 3 });
    expect(state.chosen?.value).toBe('alpha');
    const chosenBefore = state.chosen;
    state = runToCompletion(state);
    expect(state.chosen).toEqual(chosenBefore);
  });
});

describe('event-level stepping', () => {
  it('advances exactly one event per step', () => {
    const initial = createSim();
    const once = processNextEvent(initial);
    expect(initial.stats.events).toBe(0);
    expect(once.stats.events).toBe(1);
    expect(once.log.length).toBeGreaterThan(0);
    expect(once.virtualTime).toBeGreaterThanOrEqual(0);
  });
});
