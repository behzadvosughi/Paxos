import type { ReasonInfo } from '../i18n/reason';
import { draw } from './rng';

/**
 * Pure network planning: given the current configuration and PRNG state, decide
 * whether a transmission is dropped and when it arrives.
 *
 * Keeping this function pure means the network rules can be unit tested without
 * running a whole simulation, and keeps randomness inside the snapshot.
 */
export interface TransmissionInput {
  now: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  rngState: number;
  /** non-null when the link itself blocks the message (disabled / partitioned) */
  blockedReason: ReasonInfo | null;
}

export interface TransmissionPlan {
  dropped: boolean;
  arriveAt: number;
  dropAt: number | null;
  reason: ReasonInfo | null;
  rngState: number;
}

export const LINK_DISABLED: ReasonInfo = { code: 'linkDisabled' };
export const PARTITIONED: ReasonInfo = { code: 'partition' };
export const PACKET_LOSS: ReasonInfo = { code: 'packetLoss' };

export function linkKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * A link is blocked when it was explicitly disabled in either direction, or
 * when the two endpoints live on opposite sides of an active partition.
 */
export function linkBlockReason(
  from: string,
  to: string,
  disabledLinks: string[],
  partitionEnabled: boolean,
  partitionGroupA: string[],
): ReasonInfo | null {
  if (disabledLinks.includes(linkKey(from, to)) || disabledLinks.includes(linkKey(to, from))) {
    return LINK_DISABLED;
  }
  if (partitionEnabled) {
    const fromInA = partitionGroupA.includes(from);
    const toInA = partitionGroupA.includes(to);
    if (fromInA !== toInA) return PARTITIONED;
  }
  return null;
}

export function planTransmission(input: TransmissionInput): TransmissionPlan {
  if (input.blockedReason) {
    // Blocked messages still get a short trip so the failure is visible.
    const travel = Math.max(40, input.latency * 0.5);
    return {
      dropped: true,
      arriveAt: input.now + travel,
      dropAt: input.now + travel * 0.45,
      reason: input.blockedReason,
      rngState: input.rngState,
    };
  }

  const lossDraw = draw(input.rngState);
  const jitterDraw = draw(lossDraw.state);
  const travel = Math.max(1, input.latency + jitterDraw.value * input.jitter);
  const arriveAt = input.now + travel;

  if (lossDraw.value < input.packetLoss) {
    return {
      dropped: true,
      arriveAt,
      dropAt: input.now + travel * 0.55,
      reason: PACKET_LOSS,
      rngState: jitterDraw.state,
    };
  }

  return {
    dropped: false,
    arriveAt,
    dropAt: null,
    reason: null,
    rngState: jitterDraw.state,
  };
}
