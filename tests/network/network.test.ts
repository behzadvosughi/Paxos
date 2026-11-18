import { describe, expect, it } from 'vitest';
import { peekEvent } from '../../src/core/network/event-queue';
import {
  LINK_DISABLED,
  PARTITIONED,
  linkBlockReason,
  planTransmission,
} from '../../src/core/network/network-engine';
import { isPacketVisible, packetProgress } from '../../src/core/network/message';
import {
  crashNode,
  dropInflightPackets,
  processNextEvent,
  recoverNode,
  runToCompletion,
  toggleLinkFailure,
  togglePartition,
} from '../../src/core/simulation/simulation-engine';
import { createSim } from '../helpers';

describe('transmission planning', () => {
  it('delivers after the configured latency', () => {
    const plan = planTransmission({
      now: 100,
      latency: 120,
      jitter: 0,
      packetLoss: 0,
      rngState: 42,
      blockedReason: null,
    });
    expect(plan.dropped).toBe(false);
    expect(plan.arriveAt).toBe(220);
    expect(plan.dropAt).toBeNull();
  });

  it('adds a random delay bounded by the jitter', () => {
    for (let seed = 1; seed < 20; seed += 1) {
      const plan = planTransmission({
        now: 0,
        latency: 100,
        jitter: 50,
        packetLoss: 0,
        rngState: seed,
        blockedReason: null,
      });
      expect(plan.arriveAt).toBeGreaterThanOrEqual(100);
      expect(plan.arriveAt).toBeLessThanOrEqual(150);
    }
  });

  it('drops packets when loss probability is certain', () => {
    const plan = planTransmission({
      now: 0,
      latency: 100,
      jitter: 0,
      packetLoss: 1,
      rngState: 7,
      blockedReason: null,
    });
    expect(plan.dropped).toBe(true);
    expect(plan.reason).toBe('packet loss');
    expect(plan.dropAt).not.toBeNull();
  });

  it('drops packets on a disabled link', () => {
    const plan = planTransmission({
      now: 0,
      latency: 100,
      jitter: 0,
      packetLoss: 0,
      rngState: 7,
      blockedReason: LINK_DISABLED,
    });
    expect(plan.dropped).toBe(true);
    expect(plan.reason).toBe(LINK_DISABLED);
  });

  it('is deterministic for a fixed seed', () => {
    const input = {
      now: 0,
      latency: 100,
      jitter: 80,
      packetLoss: 0.3,
      rngState: 1234,
      blockedReason: null,
    };
    expect(planTransmission(input)).toEqual(planTransmission(input));
    expect(planTransmission(input).rngState).not.toBe(input.rngState);
  });
});

describe('link and partition rules', () => {
  it('blocks an explicitly disabled link in both directions', () => {
    expect(linkBlockReason('P1', 'A1', ['P1->A1'], false, [])).toBe(LINK_DISABLED);
    expect(linkBlockReason('A1', 'P1', ['P1->A1'], false, [])).toBe(LINK_DISABLED);
    expect(linkBlockReason('P1', 'A2', ['P1->A1'], false, [])).toBeNull();
  });

  it('blocks traffic across a partition but allows it on one side', () => {
    const groupA = ['P1', 'A1'];
    expect(linkBlockReason('P1', 'A2', [], true, groupA)).toBe(PARTITIONED);
    expect(linkBlockReason('P1', 'A1', [], true, groupA)).toBeNull();
    expect(linkBlockReason('A2', 'A3', [], true, groupA)).toBeNull();
  });
});

describe('packet lifecycle', () => {
  it('schedules a delivery event for every in-flight packet', () => {
    const state = createSim();
    const next = processNextEvent(state);
    const inFlight = next.messages.filter((message) => message.status === 'inflight');
    expect(inFlight.length).toBe(3);
    for (const message of inFlight) {
      expect(
        next.queue.some((event) => event.kind === 'deliver' && event.messageId === message.id),
      ).toBe(true);
      expect(message.arriveAt).toBeGreaterThan(message.sentAt);
    }
    expect(peekEvent(next.queue)?.kind).toBe('deliver');
  });

  it('marks packets delivered when they reach an active node', () => {
    let state = createSim();
    state = processNextEvent(state);
    const firstMessage = state.messages[0];
    state = runToCompletion(state);
    const messageAfter = state.messages.find((message) => message.id === firstMessage.id);
    expect(messageAfter?.status).toBe('delivered');
  });

  it('keeps packets visible only during their transmission window', () => {
    const state = createSim();
    const next = processNextEvent(state);
    const message = next.messages[0];
    expect(isPacketVisible(message, message.sentAt)).toBe(true);
    expect(isPacketVisible(message, message.arriveAt + 1)).toBe(false);
    expect(packetProgress(message, message.sentAt)).toBe(0);
    expect(packetProgress(message, message.arriveAt)).toBe(1);
  });

  it('drops packets when their destination is crashed', () => {
    let state = crashNode(createSim(), 'A1');
    state = runToCompletion(state);
    expect(state.messages.some((message) => message.dropReason?.includes('crashed'))).toBe(true);
    expect(state.acceptors[0].acceptedValue).toBeNull();
    expect(state.chosen?.value).toBe('alpha');
  });

  it('drops in-flight packets on demand and removes their delivery events', () => {
    let state = processNextEvent(createSim());
    const inFlightIds = state.messages
      .filter((message) => message.status === 'inflight')
      .map((message) => message.id);
    state = dropInflightPackets(state);
    for (const id of inFlightIds) {
      expect(state.messages.find((message) => message.id === id)?.status).toBe('dropped');
      expect(state.queue.some((event) => event.messageId === id)).toBe(false);
    }
    expect(state.chosen).toBeNull();
  });

  it('fails messages on a disabled link', () => {
    let state = toggleLinkFailure(createSim(), 'P1', 'A1');
    state = runToCompletion(state);
    expect(state.messages.some((message) => message.dropReason === LINK_DISABLED)).toBe(true);
    // Two remaining acceptors still form a quorum of three.
    expect(state.chosen?.value).toBe('alpha');
  });

  it('prevents consensus under a partition that isolates the majority of acceptors', () => {
    let state = togglePartition(createSim({ acceptorCount: 5 }));
    state = runToCompletion(state);
    expect(state.partitionEnabled).toBe(true);
    expect(state.chosen).toBeNull();
    expect(state.messages.some((message) => message.dropReason === PARTITIONED)).toBe(true);
  });
});

describe('node recovery', () => {
  it('moves a crashed node through recovering back to active', () => {
    let state = crashNode(createSim(), 'A2');
    expect(state.acceptors[1].status).toBe('crashed');
    state = recoverNode(state, 'A2');
    expect(state.acceptors[1].status).toBe('recovering');
    state = runToCompletion(state);
    expect(state.acceptors[1].status).toBe('active');
  });

  it('keeps the queue ordered by virtual time then sequence', () => {
    const state = runToCompletion(createSim({ proposerCount: 2, packetLoss: 0.1 }));
    const times = state.log.map((entry) => entry.time);
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });
});
