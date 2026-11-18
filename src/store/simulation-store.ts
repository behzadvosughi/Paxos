import { create } from 'zustand';
import type { Lang } from '../core/i18n/lang';
import { peekEvent } from '../core/network/event-queue';
import {
  crashNode,
  describeProtocol,
  dropInflightPackets,
  processNextEvent,
  recoverNode,
  retryProposal,
  toggleLinkFailure,
  togglePartition,
} from '../core/simulation/simulation-engine';
import {
  DEFAULT_CONFIG,
  createInitialState,
  type LogEntry,
  type SimulationConfig,
  type SimulationState,
} from '../core/simulation/simulation-state';
import {
  appendSnapshot,
  canRedo,
  canUndo,
  createHistory,
  type History,
} from '../core/simulation/snapshot-manager';
import { animateTo, cancelAnimation, setAnimationTime } from '../visualization/animation-clock';

export type Store = {
  config: SimulationConfig;
  state: SimulationState;
  history: History;
  isPlaying: boolean;
  speed: number;
  language: Lang;
  selectedNodeId: string | null;
  selectedPacketId: string | null;
  selectedEventId: string | null;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  /** one event without animating — used by the playback loop */
  advanceEvent: () => boolean;
  reset: () => void;
  applyConfig: (patch: Partial<SimulationConfig>) => void;
  setSpeed: (speed: number) => void;
  setLanguage: (language: Lang) => void;
  selectNode: (id: string | null) => void;
  selectPacket: (id: string | null) => void;
  selectEvent: (entry: LogEntry | null) => void;
  crash: (id: string) => void;
  recover: (id: string) => void;
  toggleLink: (a: string, b: string) => void;
  togglePartition: () => void;
  dropPackets: () => void;
  retry: (proposerId: string) => void;
  canStepBack: () => boolean;
  canStepForward: () => boolean;
  protocolStatus: () => ReturnType<typeof describeProtocol>;
};

export const useSimulationStore = create<Store>((set, get) => {
  const initial = createInitialState(DEFAULT_CONFIG);

  const commit = (next: SimulationState) => {
    set({ state: next, history: appendSnapshot(get().history, next) });
  };

  const resetWith = (config: SimulationConfig) => {
    cancelAnimation();
    const state = createInitialState(config);
    setAnimationTime(0);
    set({
      config,
      state,
      history: createHistory(state),
      isPlaying: false,
      selectedNodeId: null,
      selectedPacketId: null,
      selectedEventId: null,
    });
  };

  return {
    config: DEFAULT_CONFIG,
    state: initial,
    history: createHistory(initial),
    isPlaying: false,
    speed: 1,
    language: 'en',
    selectedNodeId: null,
    selectedPacketId: null,
    selectedEventId: null,

    play: () => {
      if (!peekEvent(get().state.queue)) return;
      set({ isPlaying: true });
    },
    pause: () => set({ isPlaying: false }),
    togglePlay: () => {
      if (get().isPlaying) {
        set({ isPlaying: false });
        return;
      }
      if (peekEvent(get().state.queue)) set({ isPlaying: true });
    },

    advanceEvent: () => {
      const { state } = get();
      if (!peekEvent(state.queue)) return false;
      const next = processNextEvent(state);
      commit(next);
      if (!next.queue.length) set({ isPlaying: false });
      return true;
    },

    stepForward: () => {
      const { state, isPlaying } = get();
      if (!peekEvent(state.queue)) {
        set({ isPlaying: false });
        return;
      }
      const next = processNextEvent(state);
      commit(next);
      if (!isPlaying) animateTo(next.virtualTime, 340);
      if (!next.queue.length) set({ isPlaying: false });
    },

    stepBackward: () => {
      const { history } = get();
      if (!canUndo(history)) return;
      const cursor = history.cursor - 1;
      const snapshot = history.snapshots[cursor];
      cancelAnimation();
      setAnimationTime(snapshot.virtualTime);
      set({
        state: snapshot,
        history: { ...history, cursor },
        isPlaying: false,
        selectedPacketId: null,
        selectedEventId: null,
      });
    },

    reset: () => resetWith(get().config),

    applyConfig: (patch) => resetWith({ ...get().config, ...patch }),

    setSpeed: (speed) => set({ speed }),

    setLanguage: (language) => set({ language }),

    selectNode: (id) => set({ selectedNodeId: id }),

    selectPacket: (id) => set({ selectedPacketId: id }),

    selectEvent: (entry) => {
      if (!entry) {
        set({ selectedEventId: null });
        return;
      }
      set({
        selectedEventId: entry.id,
        selectedPacketId: entry.packetId,
        selectedNodeId: entry.nodeId,
      });
    },

    crash: (id) => commit(crashNode(get().state, id)),
    recover: (id) => commit(recoverNode(get().state, id)),
    toggleLink: (a, b) => commit(toggleLinkFailure(get().state, a, b)),
    togglePartition: () => commit(togglePartition(get().state)),
    dropPackets: () => commit(dropInflightPackets(get().state)),
    retry: (proposerId) => commit(retryProposal(get().state, proposerId)),

    canStepBack: () => canUndo(get().history),
    canStepForward: () => canRedo(get().history) || peekEvent(get().state.queue) !== undefined,
    protocolStatus: () => describeProtocol(get().state),
  };
});
