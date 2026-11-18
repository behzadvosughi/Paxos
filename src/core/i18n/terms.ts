import type {
  MessageType,
  NodeRole,
  NodeStatus,
  ProposerPhase,
} from '../paxos/types';
import type { LogKind } from '../simulation/simulation-state';
import type { Lang, Term } from './lang';

/**
 * Bilingual (English / Persian) protocol vocabulary.
 *
 * Every user facing term lives here, so adding another language only means
 * extending these dictionaries — components read from them rather than
 * hard-coding strings.
 */
export type PacketShape = 'circle' | 'square' | 'diamond' | 'hexagon' | 'triangle';

export interface MessageMeta extends Term {
  color: string;
  shape: PacketShape;
  hint: Term;
}

export const MESSAGE_META: Record<MessageType, MessageMeta> = {
  prepare: {
    en: 'Prepare',
    fa: 'آماده‌سازی',
    color: '#3b82f6',
    shape: 'circle',
    hint: {
      en: 'Phase 1 request: “promise not to accept anything older than this ballot”.',
      fa: 'درخواست فاز ۱: «قول بده چیزی قدیمی‌تر از این رأی را نپذیری».',
    },
  },
  promise: {
    en: 'Promise',
    fa: 'قول',
    color: '#22c55e',
    shape: 'square',
    hint: {
      en: 'Phase 1 reply: the acceptor promises the ballot and reports any accepted value.',
      fa: 'پاسخ فاز ۱: پذیرنده رأی را قول می‌دهد و هر مقدار پذیرفته‌شده را گزارش می‌کند.',
    },
  },
  accept: {
    en: 'Accept',
    fa: 'پذیرش',
    color: '#f97316',
    shape: 'diamond',
    hint: {
      en: 'Phase 2 request: “accept this value for this ballot”.',
      fa: 'درخواست فاز ۲: «این مقدار را برای این رأی بپذیر».',
    },
  },
  accepted: {
    en: 'Accepted',
    fa: 'پذیرفته شد',
    color: '#a855f7',
    shape: 'hexagon',
    hint: {
      en: 'Phase 2 reply: the acceptor durably recorded the ballot and value.',
      fa: 'پاسخ فاز ۲: پذیرنده رأی و مقدار را به‌صورت پایدار ثبت کرد.',
    },
  },
  nack: {
    en: 'NACK',
    fa: 'رد',
    color: '#ef4444',
    shape: 'triangle',
    hint: {
      en: 'Rejection: the acceptor already promised a higher ballot.',
      fa: 'رد درخواست: پذیرنده قبلاً به رأی بالاتری قول داده است.',
    },
  },
};

export const ROLE_TERMS: Record<NodeRole, Term> = {
  proposer: { en: 'Proposer', fa: 'پیشنهاددهنده' },
  acceptor: { en: 'Acceptor', fa: 'پذیرنده' },
  learner: { en: 'Learner', fa: 'یادگیرنده' },
};

export const STATUS_TERMS: Record<NodeStatus, Term> = {
  active: { en: 'Active', fa: 'فعال' },
  crashed: { en: 'Crashed', fa: 'ازکارافتاده' },
  unavailable: { en: 'Unavailable', fa: 'در دسترس نیست' },
  recovering: { en: 'Recovering', fa: 'در حال بازیابی' },
};

export const PHASE_TERMS: Record<ProposerPhase, Term> = {
  idle: { en: 'Idle', fa: 'بی‌کار' },
  preparing: { en: 'Phase 1 · Prepare', fa: 'فاز ۱ · آماده‌سازی' },
  accepting: { en: 'Phase 2 · Accept', fa: 'فاز ۲ · پذیرش' },
  chosen: { en: 'Chosen', fa: 'انتخاب شد' },
  retrying: { en: 'Retrying', fa: 'تلاش دوباره' },
  stalled: { en: 'Stalled', fa: 'متوقف' },
};

/** Short labels for the event-timeline rows. */
export const KIND_TERMS: Record<LogKind, Term> = {
  prepare: { en: 'Prepare', fa: 'آماده‌سازی' },
  promise: { en: 'Promise', fa: 'قول' },
  accept: { en: 'Accept', fa: 'پذیرش' },
  accepted: { en: 'Accepted', fa: 'پذیرفته شد' },
  nack: { en: 'NACK', fa: 'رد درخواست' },
  quorum: { en: 'Quorum', fa: 'حد نصاب' },
  chosen: { en: 'Chosen', fa: 'انتخاب شد' },
  retry: { en: 'Retry', fa: 'تلاش دوباره' },
  drop: { en: 'Drop', fa: 'حذف بسته' },
  crash: { en: 'Crash', fa: 'خرابی' },
  recover: { en: 'Recover', fa: 'بازیابی' },
  partition: { en: 'Partition', fa: 'شکاف شبکه' },
  link: { en: 'Link', fa: 'لینک' },
  system: { en: 'System', fa: 'سیستم' },
};

/** Virtual milliseconds, e.g. `120 ms` / `۱۲۰` with a Persian unit. */
export function formatTime(ms: number, lang: Lang): string {
  const value = Math.round(ms);
  return lang === 'fa' ? `${value} م‌ث` : `${value} ms`;
}

export interface Concept {
  id: string;
  en: string;
  fa: string;
  explanation: string;
}

export const CONCEPTS: Concept[] = [
  {
    id: 'proposal-number',
    en: 'Proposal number',
    fa: 'شماره پیشنهاد',
    explanation:
      'Every attempt uses a ballot `(round, proposerId)`. Ballots are totally ordered, so two proposers can never issue the same ballot.',
  },
  {
    id: 'quorum',
    en: 'Quorum',
    fa: 'حد نصاب',
    explanation:
      'A strict majority: floor(N / 2) + 1 of the acceptors. Any two quorums overlap in at least one acceptor, which is the heart of Paxos safety.',
  },
  {
    id: 'chosen',
    en: 'Chosen',
    fa: 'انتخاب‌شده',
    explanation:
      'A value is chosen only when a quorum of acceptors has durably accepted the same ballot and value — not when a proposer merely sends Accept.',
  },
  {
    id: 'nack',
    en: 'NACK',
    fa: 'رد درخواست',
    explanation:
      'An acceptor refuses a ballot lower than the one it already promised. The proposer must advance its round.',
  },
  {
    id: 'partition',
    en: 'Network partition',
    fa: 'شکاف شبکه',
    explanation:
      'A split that blocks cross-group traffic. The minority side can never reach a quorum, so no conflicting value can be chosen there.',
  },
  {
    id: 'durable',
    en: 'Durable state',
    fa: 'وضعیت پایدار',
    explanation:
      'Promises and accepted values survive a crash. Forgetting them on restart can let two different values become chosen.',
  },
];
