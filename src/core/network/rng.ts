/**
 * Small deterministic PRNG (mulberry32) used by the network simulator.
 *
 * The generator state is a plain number stored inside the simulation state, so
 * snapshotting and restoring the simulation reproduces every random draw
 * exactly. That is what makes "step backward, then step forward" stable and
 * makes a run reproducible from its seed.
 */
export function createRngState(seed: number): number {
  // Mix the seed so nearby seeds produce very different streams.
  return (seed ^ 0x9e3779b9) >>> 0;
}

export interface RandomDraw {
  value: number;
  state: number;
}

export function draw(state: number): RandomDraw {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}
