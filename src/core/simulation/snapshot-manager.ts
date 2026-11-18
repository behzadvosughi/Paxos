import type { SimulationState } from './simulation-state';

/**
 * Reversible simulation via deterministic state snapshots.
 *
 * Every processed event (and every user mutation such as a crash or a link
 * failure) appends a full snapshot. Stepping backward restores one snapshot,
 * which also restores the PRNG stream — so stepping forward again reproduces
 * exactly the same run rather than re-rolling the dice.
 */
export interface History {
  snapshots: SimulationState[];
  cursor: number;
}

export const MAX_HISTORY = 300;

export function createHistory(state: SimulationState): History {
  return { snapshots: [state], cursor: 0 };
}

export function appendSnapshot(history: History, state: SimulationState): History {
  const snapshots = history.snapshots.slice(0, history.cursor + 1);
  snapshots.push(state);
  if (snapshots.length > MAX_HISTORY) {
    snapshots.splice(0, snapshots.length - MAX_HISTORY);
  }
  return { snapshots, cursor: snapshots.length - 1 };
}

export function canUndo(history: History): boolean {
  return history.cursor > 0;
}

export function canRedo(history: History): boolean {
  return history.cursor < history.snapshots.length - 1;
}

export function currentSnapshot(history: History): SimulationState {
  return history.snapshots[history.cursor];
}
