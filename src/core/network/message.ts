import type { Ballot, MessageType, PacketStatus } from '../paxos/types';

/**
 * A single protocol message. Every message is also a visual packet: its
 * `sentAt` / `arriveAt` window is what the SVG animation interpolates.
 */
export interface Message {
  id: string;
  type: MessageType;
  from: string;
  to: string;
  ballot: Ballot;
  value: string | null;
  /** carried by `promise` responses */
  acceptedBallot: Ballot | null;
  acceptedValue: string | null;
  /** reason attached to a NACK */
  reason: string | null;
  sentAt: number;
  arriveAt: number;
  status: PacketStatus;
  /** virtual time at which a dropped packet visually vanishes */
  dropAt: number | null;
  dropReason: string | null;
}

export function isPacketVisible(message: Message, time: number): boolean {
  if (message.status === 'delivered') return time < message.arriveAt;
  if (message.status === 'dropped') {
    return message.dropAt !== null && time < message.dropAt;
  }
  return time < message.arriveAt;
}

/** 0 → 1 progress of the packet along its link. */
export function packetProgress(message: Message, time: number): number {
  const end =
    message.status === 'dropped' && message.dropAt !== null ? message.dropAt : message.arriveAt;
  const span = Math.max(end - message.sentAt, 1);
  return Math.min(1, Math.max(0, (time - message.sentAt) / span));
}
