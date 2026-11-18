import { useMemo } from 'react';
import { formatEventText, type EventText } from '../core/i18n/events';
import { fill, isRtl, term, type Term } from '../core/i18n/lang';
import { formatReason, type ReasonInfo } from '../core/i18n/reason';
import { UI, type UiKey } from '../core/i18n/strings';
import { KIND_TERMS, MESSAGE_META, formatTime } from '../core/i18n/terms';
import type { LogKind } from '../core/simulation/simulation-state';
import type { MessageType } from '../core/paxos/types';
import { useSimulationStore } from '../store/simulation-store';

export interface I18n {
  lang: 'en' | 'fa';
  rtl: boolean;
  /** static UI label */
  t: (key: UiKey, params?: Record<string, string | number | undefined>) => string;
  /** pick one language from a bilingual term */
  term: (value: Term) => string;
  /** engine event text */
  event: (text: EventText) => string;
  /** rejection / drop reason */
  reason: (value: ReasonInfo) => string;
  messageType: (type: MessageType) => string;
  kind: (kind: LogKind) => string;
  time: (ms: number) => string;
}

/** Translation helpers bound to the currently selected interface language. */
export function useI18n(): I18n {
  const lang = useSimulationStore((store) => store.language);

  return useMemo<I18n>(
    () => ({
      lang,
      rtl: isRtl(lang),
      t: (key, params) => fill(UI[key][lang], params),
      term: (value) => term(value, lang),
      event: (text) => formatEventText(text, lang),
      reason: (value) => formatReason(value, lang),
      messageType: (type) => MESSAGE_META[type][lang],
      kind: (kind) => KIND_TERMS[kind][lang],
      time: (ms) => formatTime(ms, lang),
    }),
    [lang],
  );
}
