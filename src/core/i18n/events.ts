import type { MessageType } from '../paxos/types';
import { fill, type Lang, type Term } from './lang';
import { formatReason, type ReasonInfo } from './reason';
import { MESSAGE_META } from './terms';

/**
 * Every sentence the simulation engine writes into the event log.
 *
 * The engine stores `{ key, params }` instead of a finished sentence, so the
 * exact same deterministic run can be rendered in English or Persian.
 */
export type EventParam = string | number | { reason: ReasonInfo } | { message: MessageType };

export interface EventText {
  key: EventKey;
  params?: Record<string, EventParam | undefined>;
}

export function ev(
  key: EventKey,
  params?: Record<string, EventParam | undefined>,
): EventText {
  return { key, params };
}

export const EVENT_TEXT = {
  dropBlocked: {
    en: '{from} → {to} {message} ({ballot}) — {reason}',
    fa: '{from} → {to} {message} ({ballot}) — {reason}',
  },
  packetLossExpl: {
    en: 'The network dropped this packet randomly. Paxos tolerates lost packets: the proposer simply never counts this acceptor and may retry with a higher ballot.',
    fa: 'شبکه این بسته را به‌صورت تصادفی حذف کرد. پاکسوس افت بسته را تحمل می‌کند: پیشنهاددهنده این پذیرنده را به‌حساب نمی‌آورد و می‌تواند با رأی بالاتر دوباره تلاش کند.',
  },
  partitionDropExpl: {
    en: 'The two endpoints are on opposite sides of the simulated partition, so the message cannot cross. Quorum intersection is what stops a minority side from choosing a value.',
    fa: 'دو سر مبدأ و مقصد در دو سوی شکاف شبیه‌سازی‌شده قرار دارند، بنابراین پیام نمی‌تواند عبور کند. اشتراک حد نصاب‌ها همان چیزی است که مانع انتخاب مقدار در سمت اقلیت می‌شود.',
  },
  linkDropExpl: {
    en: 'This communication link was disabled by the user, so the packet never reaches its destination. The protocol treats it exactly like a lost message.',
    fa: 'این لینک ارتباطی توسط کاربر قطع شده است، بنابراین بسته هرگز به مقصد نمی‌رسد. پروتکل با آن دقیقاً مانند یک پیام گم‌شده رفتار می‌کند.',
  },
  deliveryFailed: {
    en: '{message} from {from} could not be delivered to {to} — {reason}',
    fa: 'پیام {message} از {from} به {to} نرسید — {reason}',
  },
  deliveryFailedExpl: {
    en: 'A crashed or isolated node cannot receive messages. Its durable Paxos state stays on disk, but while it is down it takes no part in quorums.',
    fa: 'گرهٔ ازکارافتاده یا منزوی نمی‌تواند پیام بگیرد. وضعیت پایدار پاکسوس آن روی دیسک می‌ماند، اما تا زمانی که پایین است در هیچ حد نصابی شرکت نمی‌کند.',
  },
  chosen: {
    en: '{count} of {total} acceptors accepted “{value}” at ballot {ballot} — quorum is {quorum}.',
    fa: '{count} از {total} پذیرنده مقدار «{value}» را در رأی {ballot} پذیرفتند — حد نصاب {quorum} است.',
  },
  chosenExpl: {
    en: 'A value is chosen only when a majority of acceptors have durably accepted the same (ballot, value). Any future proposal must reuse this value, because its promise quorum must intersect this accepting quorum.',
    fa: 'یک مقدار تنها زمانی انتخاب می‌شود که اکثریت پذیرنده‌ها همان (رأی، مقدار) را به‌صورت پایدار پذیرفته باشند. هر پیشنهاد بعدی باید همین مقدار را بپذیرد، چون حد نصاب قول‌هایش با این حد نصاب پذیرش هم‌پوشانی دارد.',
  },
  safetyViolation: {
    en: 'Two different values chosen: “{first}” and “{second}”',
    fa: 'دو مقدار متفاوت انتخاب شد: «{first}» و «{second}»',
  },
  safetyViolationExpl: {
    en: 'This must never happen in Basic Paxos. It indicates a bug in the protocol engine.',
    fa: 'این وضعیت هرگز نباید در پاکسوس پایه رخ دهد و نشانهٔ اشکال در موتور پروتکل است.',
  },
  prepareSent: {
    en: '{proposer} sends Prepare({ballot}) to {total} acceptor(s).',
    fa: '{proposer} پیام Prepare({ballot}) را به {total} پذیرنده می‌فرستد.',
  },
  prepareExpl: {
    en: 'Phase 1. The proposer asks every acceptor to promise not to accept anything older than this ballot. The promise responses also reveal any value an acceptor has already accepted.',
    fa: 'فاز ۱. پیشنهاددهنده از هر پذیرنده می‌خواهد قول دهد چیزی قدیمی‌تر از این رأی را نپذیرد. پاسخ‌های قول همچنین هر مقداری را که پذیرنده قبلاً پذیرفته آشکار می‌کنند.',
  },
  recoveredUnsafe: {
    en: '{node} is back online with its durable Paxos state ERASED (unsafe experiment).',
    fa: '{node} دوباره بالا آمد و وضعیت پایدار پاکسوس آن پاک شده است (آزمایش ناامن).',
  },
  recoveredSafe: {
    en: '{node} is back online; its promised and accepted state was preserved.',
    fa: '{node} دوباره بالا آمد؛ قول‌ها و مقادیر پذیرفته‌شدهٔ آن حفظ شده است.',
  },
  recoveredUnsafeExpl: {
    en: 'This intentionally unsafe mode forgets promises and accepted values. It can let two different values become chosen, which is exactly why Paxos requires durable state.',
    fa: 'این حالتِ عمداً ناامن قول‌ها و مقادیر پذیرفته‌شده را فراموش می‌کند و می‌تواند باعث انتخاب دو مقدار متفاوت شود؛ دقیقاً به همین دلیل پاکسوس به وضعیت پایدار نیاز دارد.',
  },
  recoveredSafeExpl: {
    en: 'Acceptor promises and accepted values are durable. A restarted acceptor must remember them, or safety can be violated.',
    fa: 'قول‌ها و مقادیر پذیرفته‌شدهٔ پذیرنده پایدار هستند. پذیرندهٔ راه‌اندازی‌شده باید آن‌ها را به یاد بیاورد، وگرنه ایمنی نقض می‌شود.',
  },
  promiseMadeValue: {
    en: '{acceptor} promises {ballot} and reports accepted “{value}” at {acceptedBallot}.',
    fa: '{acceptor} رأی {ballot} را قول می‌دهد و مقدار پذیرفته‌شدهٔ «{value}» را در {acceptedBallot} گزارش می‌کند.',
  },
  promiseMadeNone: {
    en: '{acceptor} promises {ballot} and reports no previously accepted value.',
    fa: '{acceptor} رأی {ballot} را قول می‌دهد و می‌گوید قبلاً مقداری نپذیرفته است.',
  },
  promiseWithValueExpl: {
    en: 'The promise carries the acceptor’s previously accepted proposal. The proposer must adopt the value of the highest such ballot, which protects an already chosen value.',
    fa: 'این قول، پیشنهاد پذیرفته‌شدهٔ قبلی پذیرنده را همراه دارد. پیشنهاددهنده باید مقدار بالاترین چنین رأیی را بپذیرد؛ همین امر از مقدارِ ازپیش‌انتخاب‌شده محافظت می‌کند.',
  },
  promiseNoValueExpl: {
    en: 'This acceptor had accepted nothing yet, so the proposer is free to propose its own value — provided a quorum promises.',
    fa: 'این پذیرنده هنوز چیزی نپذیرفته است، بنابراین پیشنهاددهنده می‌تواند مقدار خودش را پیشنهاد دهد — به شرط آنکه حد نصابی قول بدهد.',
  },
  nackPrepare: {
    en: '{acceptor} rejects Prepare({ballot}): {reason}.',
    fa: '{acceptor} پیام Prepare({ballot}) را رد می‌کند: {reason}.',
  },
  nackPrepareExpl: {
    en: 'The ballot is lower than a promise the acceptor already made. The proposer must advance to a higher round; this is how a competing proposer preempts an older attempt.',
    fa: 'این رأی از قولی که پذیرنده قبلاً داده پایین‌تر است. پیشنهاددهنده باید به دور بالاتری برود؛ رقابت پیشنهاددهنده‌ها به همین شکل تلاش قدیمی‌تر را کنار می‌زند.',
  },
  stalePromise: {
    en: '{proposer} ignores a Promise for {ballot} (current ballot {current}).',
    fa: '{proposer} پیام Promise برای {ballot} را نادیده می‌گیرد (رأی فعلی {current}).',
  },
  stalePromiseExpl: {
    en: 'The proposer already moved to another round, so this response belongs to an abandoned attempt and must not be counted.',
    fa: 'پیشنهاددهنده به دور دیگری رفته است، پس این پاسخ به تلاشی رهاشده تعلق دارد و نباید شمرده شود.',
  },
  promiseReceived: {
    en: '{proposer} receives Promise from {from} — {count}/{quorum} promises.',
    fa: '{proposer} از {from} قول گرفت — {count} از {quorum} قول.',
  },
  promiseReceivedExpl: {
    en: 'Each promise is one vote for phase 1. The proposer may only start phase 2 after a strict majority promises, and it must adopt the highest previously accepted value it was told about.',
    fa: 'هر قول یک رأی برای فاز ۱ است. پیشنهاددهنده تنها پس از قول اکثریت مطلق می‌تواند فاز ۲ را شروع کند و باید بالاترین مقدار پذیرفته‌شده‌ای را که به او گزارش شده بپذیرد.',
  },
  quorumReached: {
    en: '{proposer} has {count} of the {quorum} promises it needs.',
    fa: '{proposer} به {count} قول از {quorum} قول لازم رسید.',
  },
  quorumReachedExpl: {
    en: 'A promise quorum means no older ballot can still reach an accepting quorum. That is what makes phase 2 safe to start.',
    fa: 'حد نصاب قول یعنی هیچ رأی قدیمی‌تری نمی‌تواند به حد نصاب پذیرش برسد. همین امر شروع فاز ۲ را ایمن می‌کند.',
  },
  acceptOwn: {
    en: '{proposer} sends Accept({ballot}, “{value}”) — using its own value, because no acceptor reported a previous acceptance.',
    fa: '{proposer} پیام Accept({ballot}، «{value}») را می‌فرستد — با مقدار خودش، چون هیچ پذیرنده‌ای پذیرش قبلی گزارش نکرده است.',
  },
  acceptAdopted: {
    en: '{proposer} sends Accept({ballot}, “{value}”) — adopting the value already accepted at {adopted}.',
    fa: '{proposer} پیام Accept({ballot}، «{value}») را می‌فرستد — با پذیرش مقداری که قبلاً در {adopted} پذیرفته شده بود.',
  },
  acceptOwnExpl: {
    en: 'No promise carried an accepted value, so this proposal cannot conflict with a value that is already chosen.',
    fa: 'هیچ قولی مقدار پذیرفته‌شده نداشت، بنابراین این پیشنهاد با مقدارِ ازپیش‌انتخاب‌شده تعارضی ندارد.',
  },
  acceptAdoptedExpl: {
    en: 'The proposer is not free to choose here. It adopted the value of the highest accepted ballot reported in the promises, which is how a possibly chosen value survives.',
    fa: 'پیشنهاددهنده اینجا آزاد نیست. او مقدار بالاترین رأی پذیرفته‌شده را که در قول‌ها گزارش شده پذیرفت؛ به این ترتیب مقدارِ احتمالاً انتخاب‌شده حفظ می‌شود.',
  },
  accepted: {
    en: '{acceptor} accepts “{value}” at ballot {ballot}.',
    fa: '{acceptor} مقدار «{value}» را در رأی {ballot} می‌پذیرد.',
  },
  acceptedExpl: {
    en: 'The acceptor had promised nothing higher, so it durably records the accepted ballot and value. It reports this to the proposer and to all learners.',
    fa: 'پذیرنده به رأی بالاتری قول نداده بود، پس رأی و مقدار را به‌صورت پایدار ثبت می‌کند و به پیشنهاددهنده و همهٔ یادگیرنده‌ها گزارش می‌دهد.',
  },
  nackAccept: {
    en: '{acceptor} rejects Accept({ballot}): {reason}.',
    fa: '{acceptor} پیام Accept({ballot}) را رد می‌کند: {reason}.',
  },
  nackAcceptExpl: {
    en: 'A higher ballot was promised in the meantime, so this acceptor refuses the older proposal. The proposer must retry with a higher ballot.',
    fa: 'در این فاصله به رأی بالاتری قول داده شده است، پس پذیرنده پیشنهاد قدیمی‌تر را رد می‌کند. پیشنهاددهنده باید با رأی بالاتری دوباره تلاش کند.',
  },
  staleAccepted: {
    en: '{proposer} ignores an Accepted for {ballot}.',
    fa: '{proposer} پیام Accepted برای {ballot} را نادیده می‌گیرد.',
  },
  staleAcceptedExpl: {
    en: 'The proposer has already moved on to a different ballot.',
    fa: 'پیشنهاددهنده از قبل به رأی دیگری رفته است.',
  },
  acceptedReceived: {
    en: '{proposer} receives Accepted from {from} — {count}/{quorum}.',
    fa: '{proposer} از {from} پیام Accepted گرفت — {count} از {quorum}.',
  },
  acceptedReceivedExpl: {
    en: 'The proposer counts confirmations, but consensus is not declared by the proposer: it is determined by the acceptors’ durable state.',
    fa: 'پیشنهاددهنده تأییدها را می‌شمارد، اما اجماع را او اعلام نمی‌کند: اجماع بر اساس وضعیت پایدار پذیرنده‌ها تعیین می‌شود.',
  },
  learnerLearned: {
    en: '{learner} learns the chosen value “{value}”.',
    fa: '{learner} مقدار انتخاب‌شدهٔ «{value}» را یاد می‌گیرد.',
  },
  learnerRecorded: {
    en: '{learner} records Accepted from {from} for “{value}”.',
    fa: '{learner} پیام Accepted را از {from} برای «{value}» ثبت می‌کند.',
  },
  learnerLearnedExpl: {
    en: 'The learner saw a quorum of acceptors report the same (ballot, value), so it can safely act on the value.',
    fa: 'یادگیرنده دید که حد نصابی از پذیرنده‌ها همان (رأی، مقدار) را گزارش کرده‌اند، پس می‌تواند با خیال راحت بر اساس آن مقدار عمل کند.',
  },
  learnerRecordedExpl: {
    en: 'Learners are passive. They only conclude once a quorum of acceptors reports the same proposal.',
    fa: 'یادگیرنده‌ها منفعل‌اند و تنها وقتی نتیجه می‌گیرند که حد نصابی از پذیرنده‌ها یک پیشنهاد را گزارش کنند.',
  },
  nackReceived: {
    en: '{proposer} is rejected by {from}: {reason}.',
    fa: '{from} پیشنهاد {proposer} را رد کرد: {reason}.',
  },
  nackReceivedExpl: {
    en: 'A competing proposer holds a higher promise. Safety is untouched, but progress is blocked until this proposer retries with a higher ballot.',
    fa: 'یک پیشنهاددهندهٔ رقیب قول بالاتری دارد. ایمنی خدشه‌دار نمی‌شود، اما پیشرفت تا زمان تلاش دوباره با رأی بالاتر متوقف است.',
  },
  retryScheduled: {
    en: '{proposer} will retry with round {round} in {delay} ms.',
    fa: '{proposer} در {delay} م‌ث با دور {round} دوباره تلاش می‌کند.',
  },
  retryScheduledExpl: {
    en: 'The proposer advances past the highest ballot it saw. Retrying with a higher ballot can preempt the competing proposal while preserving any value already accepted.',
    fa: 'پیشنهاددهنده از بالاترین رأیی که دیده فراتر می‌رود. تلاش دوباره با رأی بالاتر می‌تواند پیشنهاد رقیب را کنار بزند و در همان حال مقدارهای پذیرفته‌شده را حفظ کند.',
  },
  crashed: {
    en: '{node} is down. Its durable Paxos state is preserved on disk.',
    fa: '{node} از کار افتاد. وضعیت پایدار پاکسوس آن روی دیسک حفظ شده است.',
  },
  crashedExpl: {
    en: 'A crashed acceptor stops answering, so it no longer counts toward any quorum. Messages sent to it are dropped on arrival.',
    fa: 'پذیرندهٔ ازکارافتاده پاسخ نمی‌دهد، پس دیگر در هیچ حد نصابی شمرده نمی‌شود. پیام‌هایی که به آن فرستاده شوند هنگام رسیدن حذف می‌شوند.',
  },
  recovering: {
    en: '{node} is restarting and will be active again in {delay} ms.',
    fa: '{node} در حال راه‌اندازی دوباره است و پس از {delay} م‌ث دوباره فعال می‌شود.',
  },
  recoveringExpl: {
    en: 'While recovering the node still cannot participate. On restart it restores its promised and accepted state from durable storage.',
    fa: 'گره در حین بازیابی هم نمی‌تواند شرکت کند و پس از راه‌اندازی دوباره، قول‌ها و مقادیر پذیرفته‌شدهٔ خود را از حافظهٔ پایدار بازمی‌گرداند.',
  },
  linkRestored: {
    en: 'Communication between {a} and {b} works again.',
    fa: 'ارتباط بین {a} و {b} دوباره برقرار شد.',
  },
  linkRestoredExpl: {
    en: 'New packets may cross this link. Packets that were already dropped stay lost.',
    fa: 'بسته‌های جدید می‌توانند از این لینک عبور کنند. بسته‌هایی که قبلاً حذف شده‌اند از دست رفته باقی می‌مانند.',
  },
  linkDisabled: {
    en: 'Communication between {a} and {b} is blocked.',
    fa: 'ارتباط بین {a} و {b} قطع شد.',
  },
  linkDisabledLost: {
    en: 'Communication between {a} and {b} is blocked; {count} in-flight packet(s) lost.',
    fa: 'ارتباط بین {a} و {b} قطع شد؛ {count} بستهٔ در راه از بین رفت.',
  },
  linkDisabledExpl: {
    en: 'A failed link silently loses messages. Paxos cannot tell a lost link from a slow node, so it simply waits or retries.',
    fa: 'لینک خراب پیام‌ها را بی‌صدا از بین می‌برد. پاکسوس نمی‌تواند لینک خراب را از گرهٔ کند تشخیص دهد، پس فقط صبر می‌کند یا دوباره تلاش می‌کند.',
  },
  partitionOn: {
    en: 'Partition active: [{group}] are isolated from the rest.',
    fa: 'شکاف فعال شد: [{group}] از بقیه جدا شدند.',
  },
  partitionOnLost: {
    en: 'Partition active: [{group}] are isolated from the rest; {count} in-flight packet(s) lost.',
    fa: 'شکاف فعال شد: [{group}] از بقیه جدا شدند؛ {count} بستهٔ در راه از بین رفت.',
  },
  partitionOnExpl: {
    en: 'Each side can still talk internally, but not across the split. Only a side holding a majority of acceptors can make progress — this is how Paxos stays safe under partition.',
    fa: 'هر طرف در داخل خودش ارتباط دارد، اما ارتباط بین دو طرف قطع است. تنها طرفی که اکثریت پذیرنده‌ها را دارد می‌تواند پیش برود — ایمنی پاکسوس در شرایط شکاف به همین شکل حفظ می‌شود.',
  },
  partitionHealed: {
    en: 'All nodes can communicate again.',
    fa: 'همهٔ گره‌ها دوباره می‌توانند ارتباط برقرار کنند.',
  },
  partitionHealedExpl: {
    en: 'Once the split heals, a proposer that retries with a higher ballot will collect promises and can finish the protocol.',
    fa: 'پس از ترمیم شکاف، پیشنهاددهنده‌ای که با رأی بالاتر دوباره تلاش کند قول‌ها را جمع می‌کند و می‌تواند پروتکل را تمام کند.',
  },
  packetsDropped: {
    en: '{count} in-flight packet(s) were dropped by the user.',
    fa: 'کاربر {count} بستهٔ در راه را حذف کرد.',
  },
  packetsDroppedExpl: {
    en: 'Simulating packet loss by hand shows how the protocol copes: missing promises simply reduce the response count, and missing accepts prevent that acceptor from contributing to the quorum.',
    fa: 'حذف دستی بسته‌ها نشان می‌دهد پروتکل چگونه کنار می‌آید: قول‌های گم‌شده فقط تعداد پاسخ‌ها را کم می‌کنند و Acceptهای گم‌شده مانع مشارکت آن پذیرنده در حد نصاب می‌شوند.',
  },
  manualRetry: {
    en: '{proposer} retries with round {round}.',
    fa: '{proposer} با دور {round} دوباره تلاش می‌کند.',
  },
  manualRetryExpl: {
    en: 'A higher ballot can break a deadlock between competing proposers. The new promises still force the proposer to adopt any value that was already accepted.',
    fa: 'رأی بالاتر می‌تواند بن‌بست بین پیشنهاددهنده‌های رقیب را بشکند. قول‌های جدید همچنان پیشنهاددهنده را ملزم می‌کنند هر مقدارِ ازپیش‌پذیرفته‌شده را بپذیرد.',
  },
} satisfies Record<string, Term>;

export type EventKey = keyof typeof EVENT_TEXT;

export function formatEventText(text: EventText, lang: Lang): string {
  const entry: Term | undefined = EVENT_TEXT[text.key];
  if (!entry) return text.key;
  const params: Record<string, string | number | undefined> = {};
  for (const [name, value] of Object.entries(text.params ?? {})) {
    if (value === undefined) continue;
    params[name] = resolveParam(value, lang);
  }
  return fill(entry[lang], params);
}

function resolveParam(value: EventParam, lang: Lang): string {
  if (typeof value === 'object') {
    return 'reason' in value ? formatReason(value.reason, lang) : MESSAGE_META[value.message][lang];
  }
  return String(value);
}
