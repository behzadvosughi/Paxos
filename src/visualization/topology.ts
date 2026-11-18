import { formatBallot } from '../core/paxos/ballot';
import type { NodeRole, NodeStatus } from '../core/paxos/types';
import type { SimulationState } from '../core/simulation/simulation-state';

export const CANVAS_WIDTH = 1120;
export const CANVAS_HEIGHT = 640;

export const NODE_WIDTH = 124;
export const NODE_HEIGHT = 84;

export interface Point {
  x: number;
  y: number;
}

/** Short, language-neutral state summary rendered inside a node card. */
export type CaptionInfo =
  | { key: 'chosen'; value: string }
  | { key: 'ballot'; ballot: string }
  | { key: 'idle' }
  | { key: 'accepted'; ballot: string }
  | { key: 'promised'; ballot: string }
  | { key: 'noPromise' }
  | { key: 'learned'; value: string }
  | { key: 'listening' }
  | { key: 'none' };

export interface NodeLayout {
  id: string;
  role: NodeRole;
  status: NodeStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  /** short state summary rendered inside the node card */
  caption: CaptionInfo;
}

export interface LinkLayout {
  id: string;
  from: string;
  to: string;
  fromPoint: Point;
  toPoint: Point;
  /** id of the node on the proposer side, used for link toggling */
  endpointA: string;
  endpointB: string;
}

const COLUMNS: Record<NodeRole, number> = {
  proposer: 140,
  acceptor: 560,
  learner: 980,
};

const TOP = 118;
const BOTTOM = 580;

function columnY(count: number, index: number): number {
  if (count <= 1) return (TOP + BOTTOM) / 2;
  const spacing = (BOTTOM - TOP) / count;
  return TOP + spacing * (index + 0.5);
}

function trim(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

function captionFor(state: SimulationState, id: string): CaptionInfo {
  const proposer = state.proposers.find((entry) => entry.id === id);
  if (proposer) {
    if (proposer.phase === 'chosen') {
      return { key: 'chosen', value: proposer.chosenValue ?? '—' };
    }
    if (proposer.ballot) return { key: 'ballot', ballot: formatBallot(proposer.ballot) };
    return { key: 'idle' };
  }
  const acceptor = state.acceptors.find((entry) => entry.id === id);
  if (acceptor) {
    if (acceptor.acceptedBallot) {
      return { key: 'accepted', ballot: formatBallot(acceptor.acceptedBallot) };
    }
    if (acceptor.promisedBallot) {
      return { key: 'promised', ballot: formatBallot(acceptor.promisedBallot) };
    }
    return { key: 'noPromise' };
  }
  const learner = state.learners.find((entry) => entry.id === id);
  if (learner) {
    return learner.chosenValue
      ? { key: 'learned', value: learner.chosenValue }
      : { key: 'listening' };
  }
  return { key: 'none' };
}

export function computeTopology(state: SimulationState): {
  nodes: NodeLayout[];
  links: LinkLayout[];
} {
  const nodes: NodeLayout[] = [];

  state.proposers.forEach((proposer, index) => {
    nodes.push({
      id: proposer.id,
      role: 'proposer',
      status: proposer.status,
      x: COLUMNS.proposer,
      y: columnY(state.proposers.length, index),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      caption: captionFor(state, proposer.id),
    });
  });

  state.acceptors.forEach((acceptor, index) => {
    nodes.push({
      id: acceptor.id,
      role: 'acceptor',
      status: acceptor.status,
      x: COLUMNS.acceptor,
      y: columnY(state.acceptors.length, index),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      caption: captionFor(state, acceptor.id),
    });
  });

  state.learners.forEach((learner, index) => {
    nodes.push({
      id: learner.id,
      role: 'learner',
      status: learner.status,
      x: COLUMNS.learner,
      y: columnY(state.learners.length, index),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      caption: captionFor(state, learner.id),
    });
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: LinkLayout[] = [];

  for (const proposer of state.proposers) {
    for (const acceptor of state.acceptors) {
      const a = byId.get(proposer.id);
      const b = byId.get(acceptor.id);
      if (!a || !b) continue;
      const fromPoint = { x: a.x, y: a.y };
      const toPoint = { x: b.x, y: b.y };
      links.push({
        id: `link-${a.id}-${b.id}`,
        from: a.id,
        to: b.id,
        fromPoint: trim(fromPoint, toPoint, 66),
        toPoint: trim(toPoint, fromPoint, 66),
        endpointA: a.id,
        endpointB: b.id,
      });
    }
  }

  for (const acceptor of state.acceptors) {
    for (const learner of state.learners) {
      const a = byId.get(acceptor.id);
      const b = byId.get(learner.id);
      if (!a || !b) continue;
      const fromPoint = { x: a.x, y: a.y };
      const toPoint = { x: b.x, y: b.y };
      links.push({
        id: `link-${a.id}-${b.id}`,
        from: a.id,
        to: b.id,
        fromPoint: trim(fromPoint, toPoint, 66),
        toPoint: trim(toPoint, fromPoint, 66),
        endpointA: a.id,
        endpointB: b.id,
      });
    }
  }

  return { nodes, links };
}

/** Position of a packet travelling between two nodes, with a small lane offset. */
export function packetPosition(
  from: Point,
  to: Point,
  progress: number,
  lane: number,
): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = lane * 3.2;
  const nx = -dy / length;
  const ny = dx / length;
  return {
    x: from.x + dx * progress + nx * offset,
    y: from.y + dy * progress + ny * offset,
  };
}

export function laneFor(packetId: string): number {
  let hash = 0;
  for (let index = 0; index < packetId.length; index += 1) {
    hash = (hash * 31 + packetId.charCodeAt(index)) % 997;
  }
  return (hash % 7) - 3;
}
