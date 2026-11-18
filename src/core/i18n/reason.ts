import { formatBallot } from '../paxos/ballot';
import type { Ballot, NodeStatus } from '../paxos/types';
import { fill, type Lang, type Term } from './lang';
import { STATUS_TERMS } from './terms';

/**
 * Language-neutral description of why a message was rejected or dropped.
 *
 * The protocol and network engines store these codes (never sentences), so the
 * UI can render the same event in any supported language.
 */
export type ReasonCode =
  | 'linkDisabled'
  | 'partition'
  | 'packetLoss'
  | 'manualDrop'
  | 'unknownDestination'
  | 'nodeNotActive'
  | 'alreadyPromised'
  | 'promisedHigher'
  | 'rejected';

export interface ReasonInfo {
  code: ReasonCode;
  /** node id, used by `nodeNotActive` */
  node?: string;
  status?: NodeStatus;
  /** promised ballot, used by `alreadyPromised` / `promisedHigher` */
  ballot?: Ballot;
}

export const REASON_TEXT: Record<ReasonCode, Term> = {
  linkDisabled: { en: 'link disabled', fa: 'لینک قطع است' },
  partition: { en: 'network partition', fa: 'شکاف شبکه' },
  packetLoss: { en: 'packet loss', fa: 'افت بسته' },
  manualDrop: { en: 'manually dropped', fa: 'حذف دستی' },
  unknownDestination: { en: 'unknown destination', fa: 'مقصد ناشناخته' },
  nodeNotActive: {
    en: '{node} is not accepting messages ({status})',
    fa: '{node} پیام نمی‌گیرد ({status})',
  },
  alreadyPromised: {
    en: 'already promised {ballot}',
    fa: 'قبلاً {ballot} را قول داده است',
  },
  promisedHigher: {
    en: 'promised {ballot}',
    fa: 'به {ballot} قول داده است',
  },
  rejected: { en: 'rejected', fa: 'رد شد' },
};

export function formatReason(reason: ReasonInfo, lang: Lang): string {
  return fill(REASON_TEXT[reason.code][lang], {
    node: reason.node,
    status: reason.status ? STATUS_TERMS[reason.status][lang] : undefined,
    ballot: reason.ballot ? formatBallot(reason.ballot) : undefined,
  });
}
