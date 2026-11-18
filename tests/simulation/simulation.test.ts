import { describe, expect, it } from 'vitest';
import {
  crashNode,
  describeProtocol,
  processNextEvent,
  recoverNode,
  runToCompletion,
  toggleLinkFailure,
} from '../../src/core/simulation/simulation-engine';
import {
  appendSnapshot,
  canRedo,
  canUndo,
  createHistory,
  currentSnapshot,
} from '../../src/core/simulation/snapshot-manager';
import type { SimulationState } from '../../src/core/simulation/simulation-state';
import { createSim } from '../helpers';

function step(history: ReturnType<typeof createHistory>): ReturnType<typeof createHistory> {
  const next = processNextEvent(currentSnapshot(history));
  return appendSnapshot(history, next);
}

describe('reversible simulation', () => {
  it('restores the exact previous state when stepping backward', () => {
    let history = createHistory(createSim());
    const origin = currentSnapshot(history);

    for (let index = 0; index < 6; index += 1) history = step(history);
    const afterSix = currentSnapshot(history);
    expect(afterSix.stats.events).toBe(6);

    // Step back five times
    for (let index = 0; index < 5; index += 1) {
      history = { ...history, cursor: history.cursor - 1 };
    }
    expect(currentSnapshot(history).stats.events).toBe(1);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(true);

    // Stepping forward again reproduces the same deterministic state.
    history = step(history);
    expect(currentSnapshot(history).stats.events).toBe(2);
    expect(currentSnapshot(history).virtualTime).toBe(
      history.snapshots[2].virtualTime,
    );
    expect(currentSnapshot(history).log.map((entry) => entry.id)).toEqual(
      history.snapshots[2].log.map((entry) => entry.id),
    );

    expect(origin.stats.events).toBe(0);
  });

  it('restores the random stream so replayed packets are identical', () => {
    let history = createHistory(createSim({ packetLoss: 0.35, seed: 99 }));
    for (let index = 0; index < 8; index += 1) history = step(history);
    const checkpoint = currentSnapshot(history);

    history = { ...history, cursor: history.cursor - 3 };
    history = step(history);
    history = step(history);
    history = step(history);

    const replayed = currentSnapshot(history);
    expect(replayed.rngState).toBe(checkpoint.rngState);
    expect(replayed.messages.length).toBe(checkpoint.messages.length);
    expect(replayed.messages.map((message) => message.arriveAt)).toEqual(
      checkpoint.messages.map((message) => message.arriveAt),
    );
  });

  it('records user failure actions as reversible snapshots', () => {
    let history = createHistory(createSim());
    history = appendSnapshot(history, crashNode(currentSnapshot(history), 'A1'));
    history = appendSnapshot(history, toggleLinkFailure(currentSnapshot(history), 'P1', 'A2'));

    expect(currentSnapshot(history).acceptors[0].status).toBe('crashed');
    expect(currentSnapshot(history).disabledLinks.length).toBe(2);

    history = { ...history, cursor: 1 };
    expect(currentSnapshot(history).acceptors[0].status).toBe('crashed');
    expect(currentSnapshot(history).disabledLinks.length).toBe(0);

    history = { ...history, cursor: 0 };
    expect(currentSnapshot(history).acceptors[0].status).toBe('active');
  });

  it('bounds the snapshot history', () => {
    let history = createHistory(createSim());
    for (let index = 0; index < 350; index += 1) {
      if (history.snapshots[history.cursor].queue.length === 0) break;
      history = step(history);
    }
    expect(history.snapshots.length).toBeLessThanOrEqual(300);
    expect(history.cursor).toBe(history.snapshots.length - 1);
  });
});

describe('protocol status', () => {
  it('reports phases, consensus and stalls', () => {
    const initial = createSim();
    expect(describeProtocol(initial)).toEqual({ key: 'ready', tone: 'idle' });

    const finished = runToCompletion(initial);
    expect(describeProtocol(finished)).toEqual({ key: 'chosen', value: 'alpha', tone: 'success' });

    let stalled: SimulationState = crashNode(createSim(), 'A2');
    stalled = crashNode(stalled, 'A3');
    stalled = runToCompletion(stalled);
    expect(describeProtocol(stalled)).toEqual({ key: 'stalled', tone: 'error' });
  });

  it('exposes a smooth recovery state before the node becomes active', () => {
    let state = crashNode(createSim(), 'A1');
    state = recoverNode(state, 'A1');
    expect(state.acceptors[0].status).toBe('recovering');
    state = runToCompletion(state);
    expect(state.acceptors[0].status).toBe('active');
  });
});
