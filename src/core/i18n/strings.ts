import type { Term } from './lang';

/**
 * Every static label, button, hint and tooltip in the interface.
 *
 * Components never hard-code user facing text: they look it up here so the
 * whole UI can be rendered in English or Persian.
 */
export const UI = {
  // header
  appTitle: { en: 'Paxos Protocol Explorer', fa: 'کاوشگر پروتکل پاکسوس' },
  appSubtitle: {
    en: 'Basic Paxos consensus · {acceptors} acceptors · quorum {quorum}',
    fa: 'اجماع پاکسوس پایه · {acceptors} پذیرنده · حد نصاب {quorum}',
  },
  languageEnglish: { en: 'English', fa: 'English' },
  languagePersian: { en: 'فارسی', fa: 'فارسی' },
  languageSwitchTitle: { en: 'Switch interface language', fa: 'تغییر زبان رابط کاربری' },

  // protocol status pill
  statusReady: { en: 'Ready', fa: 'آماده' },
  statusChosen: { en: 'Chosen: {value}', fa: 'انتخاب شد: {value}' },
  statusStalled: { en: 'Stalled — no quorum', fa: 'متوقف — بدون حد نصاب' },
  statusPhase1: { en: 'Phase 1 · Prepare', fa: 'فاز ۱ · آماده‌سازی' },
  statusPhase2: { en: 'Phase 2 · Accept', fa: 'فاز ۲ · پذیرش' },
  statusInProgress: { en: 'In progress', fa: 'در جریان' },
  statusSafety: { en: 'Safety violation', fa: 'نقض ایمنی' },

  // configuration
  configuration: { en: 'Configuration', fa: 'پیکربندی' },
  unsaved: { en: 'unsaved', fa: 'ذخیره‌نشده' },
  sectionNetwork: { en: 'Network', fa: 'شبکه' },
  acceptors: { en: 'Acceptors', fa: 'پذیرنده‌ها' },
  proposers: { en: 'Proposers', fa: 'پیشنهاددهنده‌ها' },
  learners: { en: 'Learners', fa: 'یادگیرنده‌ها' },
  networkLatency: { en: 'Network latency', fa: 'تأخیر شبکه' },
  packetDelay: { en: 'Packet delay (jitter)', fa: 'تأخیر بسته (جیتر)' },
  packetLoss: { en: 'Packet loss', fa: 'افت بسته' },
  sectionProtocol: { en: 'Protocol', fa: 'پروتکل' },
  proposalRound: { en: 'Proposal round', fa: 'دور پیشنهاد' },
  proposedValue: { en: 'Proposed value', fa: 'مقدار پیشنهادی' },
  randomSeed: { en: 'Random seed', fa: 'دانهٔ تصادفی' },
  autoRetry: { en: 'Auto-retry after NACK', fa: 'تلاش دوبارهٔ خودکار پس از NACK' },
  applyRestart: { en: 'Apply & restart', fa: 'اعمال و شروع دوباره' },
  applyHint: {
    en: 'Structural changes restart the simulation from a clean state. Speed can be changed at any time.',
    fa: 'تغییرات ساختاری شبیه‌سازی را از وضعیت پاک شروع می‌کنند. سرعت هر زمان قابل تغییر است.',
  },
  sectionFailures: { en: 'Failures', fa: 'خرابی‌ها' },
  recover: { en: 'Recover', fa: 'بازیابی' },
  crash: { en: 'Crash', fa: 'از کار انداختن' },
  simulatePartition: { en: 'Simulate network partition', fa: 'شبیه‌سازی شکاف شبکه' },
  healPartition: { en: 'Heal network partition', fa: 'ترمیم شکاف شبکه' },
  dropAllPackets: { en: 'Drop all in-flight packets', fa: 'حذف همهٔ بسته‌های در راه' },
  linkHint: {
    en: 'Click any link on the canvas to disable or restore it.',
    fa: 'برای قطع یا وصل هر لینک روی آن در بوم کلیک کنید.',
  },
  unsafeRecover: {
    en: 'Unsafe recovery: forget durable state',
    fa: 'بازیابی ناامن: فراموش کردن وضعیت پایدار',
  },
  unsafeBadge: { en: 'intentionally unsafe', fa: 'عمداً ناامن' },

  // simulation controls
  simulation: { en: 'Simulation', fa: 'شبیه‌سازی' },
  play: { en: 'Play', fa: 'پخش' },
  pause: { en: 'Pause', fa: 'توقف' },
  stepBack: { en: 'Step', fa: 'گام' },
  reset: { en: 'Reset', fa: 'بازنشانی' },
  stepBackTitle: {
    en: 'Restore the previous deterministic snapshot',
    fa: 'بازگرداندن وضعیت قطعی قبلی',
  },
  stepForwardTitle: { en: 'Process exactly one simulation event', fa: 'پردازش دقیقاً یک رویداد شبیه‌سازی' },
  animationSpeed: { en: 'Animation speed', fa: 'سرعت انیمیشن' },
  acceptedResponses: { en: 'Accepted responses', fa: 'پاسخ‌های Accepted' },
  promises: { en: 'Promises', fa: 'قول‌ها' },
  quorumFormula: {
    en: 'quorum = floor({acceptors} / 2) + 1 = {quorum}',
    fa: 'حد نصاب = ⌊{acceptors} / ۲⌋ + ۱ = {quorum}',
  },

  // network canvas
  network: { en: 'Network', fa: 'شبکه' },
  networkSummary: {
    en: '{proposers} proposer(s) · {acceptors} acceptor(s) · {learners} learner(s)',
    fa: '{proposers} پیشنهاددهنده · {acceptors} پذیرنده · {learners} یادگیرنده',
  },
  metricQuorum: { en: 'quorum', fa: 'حد نصاب' },
  metricAccepted: { en: 'accepted', fa: 'پذیرفته‌شده' },
  metricDropped: { en: 'dropped', fa: 'حذف‌شده' },
  canvasAria: { en: 'Distributed system topology', fa: 'توپولوژی سیستم توزیع‌شده' },
  canvasHint: {
    en: 'Click a node, packet or link to inspect it',
    fa: 'برای بررسی، روی گره، بسته یا لینک کلیک کنید',
  },
  linkTooltip: { en: '{a} ↔ {b} · click to disable', fa: '{a} ↔ {b} · برای قطع کلیک کنید' },
  linkTooltipBlocked: { en: '{a} ↔ {b} · {reason}', fa: '{a} ↔ {b} · {reason}' },

  // node cards
  captionChosen: { en: 'chosen · {value}', fa: 'انتخاب‌شده · {value}' },
  captionBallot: { en: 'n = {ballot}', fa: 'n = {ballot}' },
  captionIdle: { en: 'idle', fa: 'بی‌کار' },
  captionAccepted: { en: 'accepted {ballot}', fa: 'پذیرفته {ballot}' },
  captionPromised: { en: 'promised {ballot}', fa: 'قول {ballot}' },
  captionNoPromise: { en: 'no promise', fa: 'بدون قول' },
  captionLearned: { en: 'learned · {value}', fa: 'یادگرفته · {value}' },
  captionListening: { en: 'listening', fa: 'در حال گوش دادن' },
  nodeTooltip: { en: '{id} · {role} · {status}', fa: '{id} · {role} · {status}' },

  // node inspector
  nodeInspector: { en: 'Node inspector', fa: 'بازرس گره' },
  selectNodeHint: {
    en: 'Select a node in the network to inspect its internal protocol state.',
    fa: 'برای دیدن وضعیت داخلی پروتکل، یک گره را در شبکه انتخاب کنید.',
  },
  statusLabel: { en: 'Status:', fa: 'وضعیت:' },
  proposerId: { en: 'Proposer ID', fa: 'شناسهٔ پیشنهاددهنده' },
  currentBallot: { en: 'Current ballot', fa: 'رأی فعلی' },
  proposedValueField: { en: 'Proposed value', fa: 'مقدار پیشنهادی' },
  promisesField: { en: 'Promises', fa: 'قول‌ها' },
  acceptedResponsesField: { en: 'Accepted responses', fa: 'پاسخ‌های Accepted' },
  quorumRequirement: { en: 'Quorum requirement', fa: 'نیاز حد نصاب' },
  currentPhase: { en: 'Current phase', fa: 'فاز فعلی' },
  selectedValue: { en: 'Selected value', fa: 'مقدار انتخاب‌شده' },
  retries: { en: 'Retries', fa: 'تلاش‌های دوباره' },
  nacksReceived: { en: 'NACKs received', fa: 'NACKهای دریافتی' },
  retryHigherBallot: { en: 'Retry with higher ballot', fa: 'تلاش دوباره با رأی بالاتر' },
  acceptorId: { en: 'Acceptor ID', fa: 'شناسهٔ پذیرنده' },
  promisedBallot: { en: 'Promised ballot', fa: 'رأی قول‌داده‌شده' },
  acceptedBallot: { en: 'Accepted ballot', fa: 'رأی پذیرفته‌شده' },
  acceptedValue: { en: 'Accepted value', fa: 'مقدار پذیرفته‌شده' },
  nodeStatus: { en: 'Node status', fa: 'وضعیت گره' },
  receivedMessages: { en: 'Received messages', fa: 'پیام‌های دریافتی' },
  sentResponses: { en: 'Sent responses', fa: 'پاسخ‌های ارسالی' },
  emptyReceived: { en: 'No messages received yet.', fa: 'هنوز پیامی دریافت نشده است.' },
  emptySent: { en: 'No responses sent yet.', fa: 'هنوز پاسخی ارسال نشده است.' },
  learnerId: { en: 'Learner ID', fa: 'شناسهٔ یادگیرنده' },
  acceptedMessages: { en: 'Accepted messages', fa: 'پیام‌های Accepted' },
  acceptedProposal: { en: 'Accepted proposal', fa: 'پیشنهاد پذیرفته‌شده' },
  detectedChosen: { en: 'Detected chosen value', fa: 'مقدار انتخاب‌شدهٔ تشخیص‌داده‌شده' },
  emptyLearned: { en: 'No Accepted messages yet.', fa: 'هنوز پیام Acceptedی دریافت نشده است.' },

  // packet inspector
  packetInspector: { en: 'Packet inspector', fa: 'بازرس بسته' },
  packetHint: {
    en: 'Click a travelling packet (or an event in the timeline) to inspect its payload, transmission and delivery status.',
    fa: 'برای دیدن محتوا، وضعیت انتقال و تحویل، روی یک بستهٔ در راه (یا یک رویداد در خط زمانی) کلیک کنید.',
  },
  packet: { en: 'Packet', fa: 'بسته' },
  messageType: { en: 'Message type', fa: 'نوع پیام' },
  sourceNode: { en: 'Source node', fa: 'گرهٔ مبدأ' },
  destinationNode: { en: 'Destination node', fa: 'گرهٔ مقصد' },
  proposalNumber: { en: 'Proposal number', fa: 'شمارهٔ پیشنهاد' },
  valueField: { en: 'Value', fa: 'مقدار' },
  createdAt: { en: 'Created at', fa: 'زمان ایجاد' },
  transmission: { en: 'Transmission', fa: 'انتقال' },
  inFlight: { en: 'In flight', fa: 'در راه' },
  delivered: { en: 'Delivered', fa: 'تحویل‌شده' },
  lost: { en: 'Lost', fa: 'ازدست‌رفته' },
  delivery: { en: 'Delivery', fa: 'تحویل' },
  deliveredAt: { en: 'at {time}', fa: 'در {time}' },
  droppedAt: { en: 'dropped — {reason}', fa: 'حذف شد — {reason}' },
  expectedAt: { en: 'expected {time}', fa: 'انتظار در {time}' },
  payload: { en: 'Payload', fa: 'محتوا' },

  // timeline
  eventTimeline: { en: 'Event timeline', fa: 'خط زمانی رویدادها' },
  eventCount: { en: '{count} events', fa: '{count} رویداد' },
  timelineEmpty: {
    en: 'Press Play or Step ▶ to start the protocol. Every row below is a real simulation event.',
    fa: 'دکمهٔ پخش یا گام ▶ را بزنید تا پروتکل شروع شود. هر ردیف یک رویداد واقعی شبیه‌سازی است.',
  },

  // explanation card
  howItWorks: { en: 'How it works', fa: 'چگونه کار می‌کند' },
  whyThisHappened: { en: 'Why this happened', fa: 'چرا این اتفاق افتاد' },
  introBody: {
    en: 'A proposer first asks the acceptors to promise a ballot (phase 1). With a majority of promises it sends Accept for the value implied by the highest previously accepted proposal (phase 2). A value is chosen once a majority of acceptors durably accepted it — every packet you see is a real protocol message.',
    fa: 'پیشنهاددهنده ابتدا از پذیرنده‌ها می‌خواهد رأیی را قول دهند (فاز ۱). با قول اکثریت، پیام Accept را برای مقداری می‌فرستد که از بالاترین پیشنهاد پذیرفته‌شدهٔ قبلی به دست می‌آید (فاز ۲). یک مقدار زمانی انتخاب می‌شود که اکثریت پذیرنده‌ها آن را به‌صورت پایدار پذیرفته باشند — هر بسته‌ای که می‌بینید یک پیام واقعی پروتکل است.',
  },

  // footer
  footer: {
    en: 'Basic Paxos consensus simulator · runs entirely in your browser · no backend, no external API',
    fa: 'شبیه‌ساز اجماع پاکسوس پایه · کاملاً در مرورگر شما اجرا می‌شود · بدون سرور و بدون API خارجی',
  },
} satisfies Record<string, Term>;

export type UiKey = keyof typeof UI;
