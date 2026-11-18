import { processNextEvent, runToCompletion } from '../src/core/simulation/simulation-engine';
import {
  DEFAULT_CONFIG,
  createInitialState,
  type SimulationConfig,
  type SimulationState,
} from '../src/core/simulation/simulation-state';

export function createSim(patch: Partial<SimulationConfig> = {}): SimulationState {
  return createInitialState({ ...DEFAULT_CONFIG, ...patch });
}

export function runSim(patch: Partial<SimulationConfig> = {}): SimulationState {
  return runToCompletion(createSim(patch));
}

/** Process events until `predicate` is true (bounded, to avoid hanging tests). */
export function advanceUntil(
  state: SimulationState,
  predicate: (state: SimulationState) => boolean,
  limit = 200,
): SimulationState {
  let current = state;
  for (let index = 0; index < limit; index += 1) {
    if (predicate(current)) return current;
    if (current.queue.length === 0) break;
    current = processNextEvent(current);
  }
  return current;
}
